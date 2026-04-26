package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/dmdp/platform/internal/config"
	"github.com/dmdp/platform/internal/models"
	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
	"gopkg.in/gomail.v2"
	"gorm.io/gorm"
)

// --- Trigger / Action config structs ---

type TriggerConfig struct {
	// record_create | record_update | record_delete | record_match | scheduled
	Type       string             `json:"type"`
	Logic      string             `json:"logic"`      // "and" (default) | "or"
	Conditions []TriggerCondition `json:"conditions"`
	Schedule   *ScheduleConfig    `json:"schedule"`
	// legacy UI fields for scheduled trigger
	ScheduleInterval string `json:"scheduleInterval"`
	ScheduleValue    int    `json:"scheduleValue"`
}

type TriggerCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

type ScheduleConfig struct {
	Interval int    `json:"interval"`
	Unit     string `json:"unit"` // minutes | hours | days
}

type ActionConfig struct {
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// StepLog records per-action execution result
type StepLog struct {
	Type       string `json:"type"`
	Status     string `json:"status"` // success | failed
	Result     string `json:"result"`
	Error      string `json:"error"`
	DurationMs int64  `json:"duration_ms"`
}

// --- Interface ---

type AutomationEngine interface {
	Start() error
	Stop()
	TriggerEvent(eventType, modelName, recordID string, recordData map[string]interface{})
	ReloadAutomation(automationID string)
}

// --- Implementation ---

type automationEngine struct {
	cron    *cron.Cron
	db      *gorm.DB
	mu      sync.RWMutex
	cronIDs map[string]cron.EntryID
	smtpCfg config.SMTPConfig
}

var httpClient = &http.Client{Timeout: 30 * time.Second}

const maxRetries = 3

func NewAutomationEngine(db *gorm.DB, smtpCfg config.SMTPConfig) AutomationEngine {
	return &automationEngine{
		cron:    cron.New(),
		db:      db,
		cronIDs: make(map[string]cron.EntryID),
		smtpCfg: smtpCfg,
	}
}

func (e *automationEngine) Start() error {
	var automations []models.Automation
	if err := e.db.Where("enabled = true").Find(&automations).Error; err != nil {
		return err
	}
	for _, a := range automations {
		e.registerScheduledAutomation(a)
	}
	e.cron.Start()
	return nil
}

func (e *automationEngine) Stop() {
	ctx := e.cron.Stop()
	<-ctx.Done()
}

func (e *automationEngine) TriggerEvent(eventType, modelName, recordID string, recordData map[string]interface{}) {
	go e.processEvent(eventType, modelName, recordID, recordData)
}

func (e *automationEngine) ReloadAutomation(automationID string) {
	e.mu.Lock()
	if entryID, ok := e.cronIDs[automationID]; ok {
		e.cron.Remove(entryID)
		delete(e.cronIDs, automationID)
	}
	e.mu.Unlock()

	var automation models.Automation
	if err := e.db.First(&automation, "id = ?", automationID).Error; err != nil {
		return
	}
	if automation.Enabled {
		e.registerScheduledAutomation(automation)
	}
}

// --- Internal methods ---

func (e *automationEngine) processEvent(eventType, modelName, recordID string, recordData map[string]interface{}) {
	var automations []models.Automation
	e.db.Joins("JOIN models ON models.id = automations.model_id").
		Where("models.name = ? AND automations.enabled = true AND automations.deleted_at IS NULL", modelName).
		Find(&automations)

	for _, a := range automations {
		triggers := parseTriggers(a.Triggers)
		matched := false
		for _, trigger := range triggers {
			if trigger.Type == "scheduled" {
				continue
			}
			// record_match fires on record_create and record_update
			if trigger.Type == "record_match" {
				if eventType != "record_create" && eventType != "record_update" {
					continue
				}
				if !matchConditions(trigger.Logic, trigger.Conditions, recordData) {
					continue
				}
				matched = true
				break
			}
			if trigger.Type == eventType {
				matched = true
				break
			}
		}
		if matched {
			automation := a
			go e.executeAutomationWithRetry(automation, recordData, 0)
		}
	}
}

func (e *automationEngine) executeAutomationWithRetry(automation models.Automation, triggerData map[string]interface{}, attempt int) {
	defer func() {
		if r := recover(); r != nil {
			_ = r
		}
	}()

	now := time.Now()
	run := models.AutomationRun{
		ID:           uuid.New().String(),
		AutomationID: automation.ID,
		Status:       "running",
		RetryCount:   attempt,
		StartedAt:    now,
	}
	if triggerData != nil {
		if b, err := json.Marshal(triggerData); err == nil {
			run.TriggerData = string(b)
		}
	}
	e.db.Create(&run)

	var actions []ActionConfig
	if err := json.Unmarshal([]byte(automation.Actions), &actions); err != nil {
		e.finalizeRun(run.ID, automation.ID, "failed", nil, fmt.Sprintf("parse actions: %v", err))
		return
	}

	var steps []StepLog
	hasError := false
	for _, action := range actions {
		stepStart := time.Now()
		result, err := e.executeAction(action, triggerData)
		step := StepLog{
			Type:       action.Type,
			DurationMs: time.Since(stepStart).Milliseconds(),
		}
		if err != nil {
			step.Status = "failed"
			step.Error = err.Error()
			hasError = true
		} else {
			step.Status = "success"
			step.Result = result
		}
		steps = append(steps, step)
	}

	if hasError && attempt < maxRetries-1 {
		e.finalizeRun(run.ID, automation.ID, "failed", steps, "retrying")
		backoff := time.Duration(1<<uint(attempt)) * time.Second
		time.Sleep(backoff)
		go e.executeAutomationWithRetry(automation, triggerData, attempt+1)
		return
	}

	status := "success"
	if hasError {
		status = "failed"
	}
	e.finalizeRun(run.ID, automation.ID, status, steps, "")
}

func (e *automationEngine) finalizeRun(runID, automationID, status string, steps []StepLog, errMsg string) {
	now := time.Now()
	updates := map[string]interface{}{
		"status":       status,
		"error":        errMsg,
		"completed_at": now,
	}
	if steps != nil {
		if b, err := json.Marshal(steps); err == nil {
			updates["steps"] = string(b)
			// build summary result from steps
			var parts []string
			for _, s := range steps {
				if s.Status == "success" {
					parts = append(parts, fmt.Sprintf("[%s] %s (%dms)", s.Type, s.Result, s.DurationMs))
				} else {
					parts = append(parts, fmt.Sprintf("[%s] error: %s (%dms)", s.Type, s.Error, s.DurationMs))
				}
			}
			updates["result"] = strings.Join(parts, "\n")
		}
	}
	e.db.Model(&models.AutomationRun{}).Where("id = ?", runID).Updates(updates)
	e.db.Model(&models.Automation{}).Where("id = ?", automationID).
		UpdateColumn("run_count", gorm.Expr("run_count + 1"))
}

func (e *automationEngine) executeAction(action ActionConfig, triggerData map[string]interface{}) (string, error) {
	switch action.Type {
	case "api_call":
		return e.executeAPICall(action.Config, triggerData)
	case "send_email":
		return e.executeSendEmail(action.Config, triggerData)
	case "update_record":
		return e.executeUpdateRecord(action.Config, triggerData)
	case "create_record":
		return e.executeCreateRecord(action.Config, triggerData)
	default:
		return "", fmt.Errorf("unknown action type: %s", action.Type)
	}
}

func (e *automationEngine) executeAPICall(cfg map[string]interface{}, triggerData map[string]interface{}) (string, error) {
	method := stringVal(cfg, "method", "POST")
	rawURL := stringVal(cfg, "url", "")
	body := stringVal(cfg, "body", "")

	if rawURL == "" {
		return "", fmt.Errorf("api_call: url is required")
	}

	rawURL = interpolate(rawURL, triggerData)
	body = interpolate(body, triggerData)

	var bodyReader io.Reader
	if body != "" {
		bodyReader = bytes.NewBufferString(body)
	}

	req, err := http.NewRequest(method, rawURL, bodyReader)
	if err != nil {
		return "", err
	}

	if headers, ok := cfg["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			req.Header.Set(k, fmt.Sprintf("%v", v))
		}
	}
	if body != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	return fmt.Sprintf("HTTP %d", resp.StatusCode), nil
}

func (e *automationEngine) executeSendEmail(cfg map[string]interface{}, triggerData map[string]interface{}) (string, error) {
	if e.smtpCfg.Host == "" {
		return "", fmt.Errorf("SMTP not configured")
	}

	to := interpolate(stringVal(cfg, "to", ""), triggerData)
	subject := interpolate(stringVal(cfg, "subject", ""), triggerData)
	body := interpolate(stringVal(cfg, "body", ""), triggerData)

	if to == "" {
		return "", fmt.Errorf("send_email: to is required")
	}

	m := gomail.NewMessage()
	m.SetHeader("From", e.smtpCfg.From)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", body)

	d := gomail.NewDialer(e.smtpCfg.Host, e.smtpCfg.Port, e.smtpCfg.Username, e.smtpCfg.Password)
	if err := d.DialAndSend(m); err != nil {
		return "", err
	}
	return fmt.Sprintf("email sent to %s", to), nil
}

func (e *automationEngine) executeUpdateRecord(cfg map[string]interface{}, triggerData map[string]interface{}) (string, error) {
	modelName := stringVal(cfg, "model", "")
	recordID := stringVal(cfg, "record_id", "")
	if modelName == "" {
		return "", fmt.Errorf("update_record: model is required")
	}
	// use trigger record id if not specified
	if recordID == "" {
		if id, ok := triggerData["id"]; ok {
			recordID = fmt.Sprintf("%v", id)
		}
	}
	recordID = interpolate(recordID, triggerData)
	if recordID == "" {
		return "", fmt.Errorf("update_record: record_id is required")
	}

	fields, ok := cfg["fields"].(map[string]interface{})
	if !ok || len(fields) == 0 {
		return "", fmt.Errorf("update_record: fields is required")
	}

	// interpolate field values
	interpolated := make(map[string]interface{}, len(fields))
	for k, v := range fields {
		interpolated[k] = interpolate(fmt.Sprintf("%v", v), triggerData)
	}

	// find model table name
	var mdl models.Model
	if err := e.db.Where("name = ?", modelName).First(&mdl).Error; err != nil {
		return "", fmt.Errorf("update_record: model %q not found", modelName)
	}

	if err := e.db.Table(mdl.TableName).Where("id = ?", recordID).Updates(interpolated).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("updated record %s in %s", recordID, modelName), nil
}

func (e *automationEngine) executeCreateRecord(cfg map[string]interface{}, triggerData map[string]interface{}) (string, error) {
	modelName := stringVal(cfg, "model", "")
	if modelName == "" {
		return "", fmt.Errorf("create_record: model is required")
	}

	fields, ok := cfg["fields"].(map[string]interface{})
	if !ok || len(fields) == 0 {
		return "", fmt.Errorf("create_record: fields is required")
	}

	interpolated := make(map[string]interface{}, len(fields)+1)
	for k, v := range fields {
		interpolated[k] = interpolate(fmt.Sprintf("%v", v), triggerData)
	}
	interpolated["id"] = uuid.New().String()

	var mdl models.Model
	if err := e.db.Where("name = ?", modelName).First(&mdl).Error; err != nil {
		return "", fmt.Errorf("create_record: model %q not found", modelName)
	}

	if err := e.db.Table(mdl.TableName).Create(interpolated).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("created record in %s", modelName), nil
}

func (e *automationEngine) registerScheduledAutomation(automation models.Automation) {
	triggers := parseTriggers(automation.Triggers)
	for _, trigger := range triggers {
		if trigger.Type != "scheduled" {
			continue
		}
		spec := triggerToSpec(&trigger)
		if spec == "" {
			continue
		}
		a := automation
		entryID, err := e.cron.AddFunc(spec, func() {
			go e.executeAutomationWithRetry(a, map[string]interface{}{"trigger": "scheduled"}, 0)
		})
		if err != nil {
			continue
		}
		e.mu.Lock()
		e.cronIDs[automation.ID] = entryID
		e.mu.Unlock()
		break // one scheduled trigger per automation
	}
}

// --- Helpers ---

// parseTriggers handles both single-object and array JSON formats
func parseTriggers(raw string) []TriggerConfig {
	if raw == "" {
		return nil
	}
	// try array first
	var arr []TriggerConfig
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		return arr
	}
	// fallback to single object
	var single TriggerConfig
	if err := json.Unmarshal([]byte(raw), &single); err == nil {
		return []TriggerConfig{single}
	}
	return nil
}

func matchConditions(logic string, conditions []TriggerCondition, data map[string]interface{}) bool {
	if len(conditions) == 0 {
		return true
	}
	isOr := strings.ToLower(logic) == "or"
	for _, cond := range conditions {
		val := data[cond.Field]
		result := evalCondition(normalizeOperator(cond.Operator), val, cond.Value)
		if isOr && result {
			return true
		}
		if !isOr && !result {
			return false
		}
	}
	return !isOr
}

// normalizeOperator maps frontend operator names to internal ones
func normalizeOperator(op string) string {
	switch op {
	case "equals":
		return "eq"
	case "not_equals":
		return "neq"
	case "greater_than":
		return "gt"
	case "less_than":
		return "lt"
	case "greater_or_equal":
		return "gte"
	case "less_or_equal":
		return "lte"
	case "not_contains":
		return "not_contains"
	case "is_empty":
		return "is_empty"
	case "is_not_empty":
		return "is_not_empty"
	}
	return op
}

func evalCondition(operator string, actual, expected interface{}) bool {
	actualStr := fmt.Sprintf("%v", actual)
	expectedStr := fmt.Sprintf("%v", expected)

	switch operator {
	case "eq":
		return actualStr == expectedStr
	case "neq":
		return actualStr != expectedStr
	case "contains":
		return strings.Contains(actualStr, expectedStr)
	case "not_contains":
		return !strings.Contains(actualStr, expectedStr)
	case "is_empty":
		return actual == nil || actualStr == "" || actualStr == "<nil>"
	case "is_not_empty":
		return actual != nil && actualStr != "" && actualStr != "<nil>"
	case "gt", "lt", "gte", "lte":
		a, errA := toFloat(actual)
		b, errB := toFloat(expected)
		if errA != nil || errB != nil {
			return false
		}
		switch operator {
		case "gt":
			return a > b
		case "lt":
			return a < b
		case "gte":
			return a >= b
		case "lte":
			return a <= b
		}
	}
	return false
}

func toFloat(v interface{}) (float64, error) {
	switch n := v.(type) {
	case float64:
		return n, nil
	case float32:
		return float64(n), nil
	case int:
		return float64(n), nil
	case int64:
		return float64(n), nil
	case string:
		var f float64
		_, err := fmt.Sscanf(n, "%f", &f)
		return f, err
	}
	return 0, fmt.Errorf("not a number")
}

func triggerToSpec(t *TriggerConfig) string {
	// prefer structured schedule field
	if t.Schedule != nil && t.Schedule.Interval > 0 {
		return scheduleToSpec(t.Schedule)
	}
	// fallback: legacy UI fields (scheduleValue / scheduleInterval)
	if t.ScheduleValue > 0 && t.ScheduleInterval != "" {
		return scheduleToSpec(&ScheduleConfig{Interval: t.ScheduleValue, Unit: t.ScheduleInterval})
	}
	return ""
}

func scheduleToSpec(s *ScheduleConfig) string {
	if s.Interval <= 0 {
		return ""
	}
	switch s.Unit {
	case "minutes":
		return fmt.Sprintf("@every %dm", s.Interval)
	case "hours":
		return fmt.Sprintf("@every %dh", s.Interval)
	case "days":
		return fmt.Sprintf("@every %dh", s.Interval*24)
	}
	return ""
}

func interpolate(template string, data map[string]interface{}) string {
	if data == nil {
		return template
	}
	for k, v := range data {
		template = strings.ReplaceAll(template, "{{"+k+"}}", fmt.Sprintf("%v", v))
	}
	return template
}

func stringVal(m map[string]interface{}, key, defaultVal string) string {
	if v, ok := m[key]; ok {
		return fmt.Sprintf("%v", v)
	}
	return defaultVal
}
