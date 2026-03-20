// 组件类型定义
export type ComponentType = 
  // 表单组件
  | 'input' 
  | 'textarea' 
  | 'select' 
  | 'date-picker' 
  | 'upload' 
  | 'checkbox' 
  | 'radio' 
  | 'switch'
  // 展示组件
  | 'table' 
  | 'list' 
  | 'card' 
  | 'detail' 
  | 'chart' 
  | 'statistic'
  // 布局组件
  | 'container' 
  | 'grid' 
  | 'tabs' 
  | 'collapse' 
  | 'modal'
  | 'divider'

export interface ComponentDefinition {
  type: ComponentType
  name: string
  icon: string
  category: 'form' | 'display' | 'layout'
  defaultProps: any
  defaultStyle: any
  propSchema: PropSchema[]
}

export interface PropSchema {
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'model' | 'field'
  required?: boolean
  default?: any
  options?: { label: string; value: any }[]
}

// 组件定义注册表
export const componentRegistry: Record<ComponentType, ComponentDefinition> = {
  // 表单组件
  input: {
    type: 'input',
    name: '输入框',
    icon: 'EditOutlined',
    category: 'form',
    defaultProps: {
      placeholder: '请输入',
      disabled: false,
      allowClear: true,
      maxLength: 100,
    },
    defaultStyle: {
      width: '100%',
    },
    propSchema: [
      { name: 'placeholder', label: '占位符', type: 'string', default: '请输入' },
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
      { name: 'allowClear', label: '允许清除', type: 'boolean', default: true },
      { name: 'maxLength', label: '最大长度', type: 'number', default: 100 },
    ],
  },
  
  textarea: {
    type: 'textarea',
    name: '文本域',
    icon: 'FileTextOutlined',
    category: 'form',
    defaultProps: {
      placeholder: '请输入',
      rows: 4,
      disabled: false,
    },
    defaultStyle: {
      width: '100%',
    },
    propSchema: [
      { name: 'placeholder', label: '占位符', type: 'string', default: '请输入' },
      { name: 'rows', label: '行数', type: 'number', default: 4 },
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
    ],
  },
  
  select: {
    type: 'select',
    name: '选择器',
    icon: 'DownOutlined',
    category: 'form',
    defaultProps: {
      placeholder: '请选择',
      disabled: false,
      allowClear: true,
      options: [],
    },
    defaultStyle: {
      width: '100%',
    },
    propSchema: [
      { name: 'placeholder', label: '占位符', type: 'string', default: '请选择' },
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
      { name: 'allowClear', label: '允许清除', type: 'boolean', default: true },
    ],
  },
  
  'date-picker': {
    type: 'date-picker',
    name: '日期选择器',
    icon: 'CalendarOutlined',
    category: 'form',
    defaultProps: {
      placeholder: '请选择日期',
      disabled: false,
      format: 'YYYY-MM-DD',
    },
    defaultStyle: {
      width: '100%',
    },
    propSchema: [
      { name: 'placeholder', label: '占位符', type: 'string', default: '请选择日期' },
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
      { name: 'format', label: '格式', type: 'string', default: 'YYYY-MM-DD' },
    ],
  },
  
  upload: {
    type: 'upload',
    name: '文件上传',
    icon: 'UploadOutlined',
    category: 'form',
    defaultProps: {
      multiple: false,
      disabled: false,
      accept: '*',
    },
    defaultStyle: {},
    propSchema: [
      { name: 'multiple', label: '多选', type: 'boolean', default: false },
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
      { name: 'accept', label: '文件类型', type: 'string', default: '*' },
    ],
  },
  
  checkbox: {
    type: 'checkbox',
    name: '复选框',
    icon: 'CheckSquareOutlined',
    category: 'form',
    defaultProps: {
      disabled: false,
    },
    defaultStyle: {},
    propSchema: [
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
    ],
  },
  
  radio: {
    type: 'radio',
    name: '单选框',
    icon: 'RadioOutlined',
    category: 'form',
    defaultProps: {
      disabled: false,
      options: [],
    },
    defaultStyle: {},
    propSchema: [
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
    ],
  },
  
  switch: {
    type: 'switch',
    name: '开关',
    icon: 'SwitchOutlined',
    category: 'form',
    defaultProps: {
      disabled: false,
      checkedChildren: '开',
      unCheckedChildren: '关',
    },
    defaultStyle: {},
    propSchema: [
      { name: 'disabled', label: '禁用', type: 'boolean', default: false },
      { name: 'checkedChildren', label: '选中文本', type: 'string', default: '开' },
      { name: 'unCheckedChildren', label: '未选中文本', type: 'string', default: '关' },
    ],
  },
  
  // 展示组件
  table: {
    type: 'table',
    name: '表格',
    icon: 'TableOutlined',
    category: 'display',
    defaultProps: {
      dataSource: { type: 'model', model: '' },
      columns: [],
      pagination: { pageSize: 10 },
      rowSelection: false,
    },
    defaultStyle: {},
    propSchema: [
      { name: 'dataSource', label: '数据源', type: 'model', required: true },
      { name: 'pagination', label: '分页', type: 'boolean', default: true },
      { name: 'rowSelection', label: '行选择', type: 'boolean', default: false },
    ],
  },
  
  list: {
    type: 'list',
    name: '列表',
    icon: 'UnorderedListOutlined',
    category: 'display',
    defaultProps: {
      dataSource: { type: 'model', model: '' },
      renderItem: 'default',
    },
    defaultStyle: {},
    propSchema: [
      { name: 'dataSource', label: '数据源', type: 'model', required: true },
    ],
  },
  
  card: {
    type: 'card',
    name: '卡片',
    icon: 'CreditCardOutlined',
    category: 'display',
    defaultProps: {
      title: '卡片标题',
      bordered: true,
      hoverable: false,
    },
    defaultStyle: {},
    propSchema: [
      { name: 'title', label: '标题', type: 'string', default: '卡片标题' },
      { name: 'bordered', label: '边框', type: 'boolean', default: true },
      { name: 'hoverable', label: '悬停效果', type: 'boolean', default: false },
    ],
  },
  
  detail: {
    type: 'detail',
    name: '详情',
    icon: 'ProfileOutlined',
    category: 'display',
    defaultProps: {
      dataSource: { type: 'model', model: '' },
      fields: [],
    },
    defaultStyle: {},
    propSchema: [
      { name: 'dataSource', label: '数据源', type: 'model', required: true },
    ],
  },
  
  chart: {
    type: 'chart',
    name: '图表',
    icon: 'BarChartOutlined',
    category: 'display',
    defaultProps: {
      chartType: 'line',
      dataSource: { type: 'model', model: '' },
    },
    defaultStyle: {
      height: '300px',
    },
    propSchema: [
      { name: 'chartType', label: '图表类型', type: 'select', default: 'line', 
        options: [
          { label: '折线图', value: 'line' },
          { label: '柱状图', value: 'bar' },
          { label: '饼图', value: 'pie' },
        ]
      },
      { name: 'dataSource', label: '数据源', type: 'model', required: true },
    ],
  },
  
  statistic: {
    type: 'statistic',
    name: '统计数值',
    icon: 'DashboardOutlined',
    category: 'display',
    defaultProps: {
      title: '统计标题',
      value: 0,
      suffix: '',
    },
    defaultStyle: {},
    propSchema: [
      { name: 'title', label: '标题', type: 'string', default: '统计标题' },
      { name: 'value', label: '数值', type: 'number', default: 0 },
      { name: 'suffix', label: '后缀', type: 'string', default: '' },
    ],
  },
  
  // 布局组件
  container: {
    type: 'container',
    name: '容器',
    icon: 'BlockOutlined',
    category: 'layout',
    defaultProps: {
      padding: 16,
      background: '#fff',
    },
    defaultStyle: {
      minHeight: '100px',
    },
    propSchema: [
      { name: 'padding', label: '内边距', type: 'number', default: 16 },
      { name: 'background', label: '背景色', type: 'color', default: '#fff' },
    ],
  },
  
  grid: {
    type: 'grid',
    name: '栅格',
    icon: 'AppstoreOutlined',
    category: 'layout',
    defaultProps: {
      columns: 2,
      gap: 16,
    },
    defaultStyle: {},
    propSchema: [
      { name: 'columns', label: '列数', type: 'number', default: 2 },
      { name: 'gap', label: '间距', type: 'number', default: 16 },
    ],
  },
  
  tabs: {
    type: 'tabs',
    name: '标签页',
    icon: 'FolderOutlined',
    category: 'layout',
    defaultProps: {
      tabs: [{ key: '1', label: '标签1' }],
    },
    defaultStyle: {},
    propSchema: [],
  },
  
  collapse: {
    type: 'collapse',
    name: '折叠面板',
    icon: 'DownSquareOutlined',
    category: 'layout',
    defaultProps: {
      accordion: false,
      panels: [{ key: '1', header: '面板1' }],
    },
    defaultStyle: {},
    propSchema: [
      { name: 'accordion', label: '手风琴模式', type: 'boolean', default: false },
    ],
  },
  
  modal: {
    type: 'modal',
    name: '模态框',
    icon: 'FullscreenOutlined',
    category: 'layout',
    defaultProps: {
      title: '模态框标题',
      width: 520,
      visible: false,
    },
    defaultStyle: {},
    propSchema: [
      { name: 'title', label: '标题', type: 'string', default: '模态框标题' },
      { name: 'width', label: '宽度', type: 'number', default: 520 },
    ],
  },
  
  divider: {
    type: 'divider',
    name: '分割线',
    icon: 'MinusOutlined',
    category: 'layout',
    defaultProps: {
      orientation: 'center',
      dashed: false,
    },
    defaultStyle: {},
    propSchema: [
      { name: 'orientation', label: '方向', type: 'select', default: 'center',
        options: [
          { label: '居左', value: 'left' },
          { label: '居中', value: 'center' },
          { label: '居右', value: 'right' },
        ]
      },
      { name: 'dashed', label: '虚线', type: 'boolean', default: false },
    ],
  },
}

// 获取组件分类
export const getComponentsByCategory = (category: 'form' | 'display' | 'layout') => {
  return Object.values(componentRegistry).filter(comp => comp.category === category)
}

// 获取所有组件
export const getAllComponents = () => {
  return Object.values(componentRegistry)
}
