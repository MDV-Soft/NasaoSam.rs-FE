// Jedna opcija za padajući meni: value ide na server, label se prikazuje korisniku
export interface OptionItem {
  value: string;
  label: string;
}

// Odgovor servera na GET /api/meta/options
export interface ItemOptions {
  categories: OptionItem[];
  documentTypes: OptionItem[];
  colors: OptionItem[];
}
