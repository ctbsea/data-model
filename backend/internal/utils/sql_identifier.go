package utils

import (
	"fmt"
	"regexp"
	"strings"
)

var safeSQLIdentifier = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func IsSafeSQLIdentifier(identifier string) bool {
	return safeSQLIdentifier.MatchString(identifier)
}

func QuoteSQLIdentifier(identifier string) (string, error) {
	if !IsSafeSQLIdentifier(identifier) {
		return "", fmt.Errorf("invalid SQL identifier: %s", identifier)
	}
	return `"` + strings.ReplaceAll(identifier, `"`, `""`) + `"`, nil
}

func QuoteSQLAlias(alias string) string {
	return `"` + strings.ReplaceAll(alias, `"`, `""`) + `"`
}

func QuoteSQLIdentifiers(identifiers []string) ([]string, error) {
	quoted := make([]string, 0, len(identifiers))
	for _, identifier := range identifiers {
		q, err := QuoteSQLIdentifier(identifier)
		if err != nil {
			return nil, err
		}
		quoted = append(quoted, q)
	}
	return quoted, nil
}

func NormalizeSortOrder(order string) (string, error) {
	switch strings.ToUpper(order) {
	case "ASC":
		return "ASC", nil
	case "DESC", "":
		return "DESC", nil
	default:
		return "", fmt.Errorf("invalid sort order: %s", order)
	}
}

func SQLStringLiteral(value string) string {
	return `'` + strings.ReplaceAll(value, `'`, `''`) + `'`
}
