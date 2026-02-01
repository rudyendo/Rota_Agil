// TRECHO ATUALIZADO DO App.tsx
// Substitua a função saveCustomer pela versão abaixo

import { buscarCoordenadas } from './services/geocodingService';

// ... (resto do código permanece igual)

const saveCustomer = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingCustomer?.name || !editingCustomer?.address) return;

  // ✅ NOVO: Busca coordenadas automaticamente se não tiver
  let clienteParaSalvar = { ...editingCustomer };
  
  if (!clienteParaSalvar.latitude || !clienteParaSalvar.longitude) {
    console.log('🔍 Buscando coordenadas para:', clienteParaSalvar.address);
    
    try {
      const coords = await buscarCoordenadas(
        clienteParaSalvar.address,
        clienteParaSalvar.city || 'Natal',
        clienteParaSalvar.state || 'RN'
      );
      
      if (coords) {
        clienteParaSalvar.latitude = coords.lat;
        clienteParaSalvar.longitude = coords.lng;
        console.log('✅ Coordenadas encontradas:', coords);
      } else {
        console.warn('⚠️ Não foi possível encontrar coordenadas automaticamente');
      }
    } catch (error) {
      console.error('Erro ao buscar coordenadas:', error);
    }
  }

  setCustomers(prev => {
    const updated = [...prev];
    if (clienteParaSalvar.id) {
      const idx = updated.findIndex(c => c.id === clienteParaSalvar.id);
      if (idx >= 0) updated[idx] = clienteParaSalvar as Customer;
    } else {
      const newCust: Customer = {
        ...(clienteParaSalvar as Customer),
        id: Math.random().toString(36).substr(2, 9),
        phone: clienteParaSalvar.phone || [],
        secondaryAddresses: clienteParaSalvar.secondaryAddresses || []
      };
      updated.unshift(newCust);
    }
    return updated;
  });
  
  setIsManualModalOpen(false);
  setEditingCustomer(null);
};
