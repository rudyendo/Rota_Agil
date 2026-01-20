
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
  latitude?: number;
  longitude?: number;
}

export interface RouteStop {
  customerId: string;
  order: number;
}
