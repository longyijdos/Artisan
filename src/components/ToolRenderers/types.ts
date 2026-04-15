// Shared types for frontend tool renderers.

export interface TextField {
  name: string;
  type?: "text";
  placeholder?: string;
  required?: boolean;
}

export interface SelectField {
  name: string;
  type: "select";
  options: string[];
  required?: boolean;
}

export type Field = TextField | SelectField;
