// services/routeService.ts
import { Customer } from '../types';

// --- Matemática da Terra (Fórmula de Haversine) ---
// Calcula a distância em km entre dois pontos considerando a curvatura da Terra
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Organiza a rota usando o método "Vizinho Mais Próximo".
 * @param pontoPartida - Onde o entregador começa (ex: Sede)
 * @param clientes - A lista de clientes para visitar
 */
export const otimizarRota = (
  pontoPartida: { lat: number, lng: number }, 
  clientes: Customer[]
): Customer[] => {
  
  // 1. Separa quem tem GPS de quem não tem
  const comCoords = clientes.filter(c => c.latitude !== undefined && c.longitude !== undefined);
  const semCoords = clientes.filter(c => c.latitude === undefined || c.longitude === undefined);

  // Se ninguém tiver GPS, devolve a lista original sem mexer
  if (comCoords.length === 0) return clientes;

  const rotaOrdenada: Customer[] = [];
  
  // Começamos a rota na posição do ponto de partida
  let atualLat = pontoPartida.lat;
  let atualLng = pontoPartida.lng;

  // Vamos usar uma cópia para ir removendo os visitados
  const pendentes = [...comCoords];

  // 2. Loop principal: Enquanto houver clientes pendentes...
  while (pendentes.length > 0) {
    let indexMaisProximo = -1;
    let menorDistancia = Infinity;

    // Compara a distância do ponto ATUAL para todos os pendentes
    for (let i = 0; i < pendentes.length; i++) {
      const cliente = pendentes[i];
      // O compilador TypeScript reclama se não garantirmos que existe, por isso o "!" ou verificação
      if (cliente.latitude && cliente.longitude) {
        const dist = calcularDistanciaKm(atualLat, atualLng, cliente.latitude, cliente.longitude);
        
        if (dist < menorDistancia) {
          menorDistancia = dist;
          indexMaisProximo = i;
        }
      }
    }

    // 3. Achamos o vencedor!
    if (indexMaisProximo !== -1) {
      const proximoCliente = pendentes[indexMaisProximo];
      
      // Adiciona à rota final
      rotaOrdenada.push(proximoCliente);
      
      // Atualiza a nossa posição: agora estamos neste cliente
      if (proximoCliente.latitude && proximoCliente.longitude) {
        atualLat = proximoCliente.latitude;
        atualLng = proximoCliente.longitude;
      }

      // Remove da lista de pendentes para não visitar de novo
      pendentes.splice(indexMaisProximo, 1);
    } else {
      break; // Segurança
    }
  }

  // 4. Retorna a rota organizada + os clientes sem GPS no final (para não serem esquecidos)
  return [...rotaOrdenada, ...semCoords];
};
