// types.ts

export interface Customer {
  id: string;
  name: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone: string[];
  secondaryAddresses: string[];
  status?: string;
  lastVisit?: string;
  notes?: string;

  // --- Novos campos para a Rota ---
  latitude?: number;
  longitude?: number;
  // -------------------------------
}

export interface RouteStop {
  customerId: string;
  order: number;
}
