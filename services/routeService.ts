
import { Customer } from '../types';

/**
 * Calcula a distância em km entre dois pontos usando a fórmula de Haversine
 */
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Robô de Otimização Matemática (Vizinho Mais Próximo)
 * Resolve o problema do caixeiro viajante de forma eficiente para uso móvel.
 */
export const optimizeRouteRobo = (
  customers: Customer[], 
  startLat?: number, 
  startLng?: number
): Customer[] => {
  if (customers.length <= 1) return customers;

  const unvisited = [...customers];
  const optimized: Customer[] = [];
  
  // Define o ponto de partida (localização atual ou primeiro da lista)
  let currentLat = startLat || customers[0].latitude || 0;
  let currentLng = startLng || customers[0].longitude || 0;

  while (unvisited.length > 0) {
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const target = unvisited[i];
      // Se não tiver coordenadas, assume distância infinita para ir pro final
      const dist = (target.latitude && target.longitude) 
        ? getDistance(currentLat, currentLng, target.latitude, target.longitude)
        : 999999;

      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const nextCustomer = unvisited.splice(closestIndex, 1)[0];
    optimized.push(nextCustomer);
    
    // Atualiza a posição para o próximo passo
    if (nextCustomer.latitude && nextCustomer.longitude) {
      currentLat = nextCustomer.latitude;
      currentLng = nextCustomer.longitude;
    }
  }

  return optimized;
};
