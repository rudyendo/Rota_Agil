// services/routeService.ts
import { Customer } from '../types';

// ====================================
// CONFIGURAÇÃO DA API
// ====================================
const OPENROUTE_API_KEY = import.meta.env.VITE_OPENROUTE_API_KEY || '';
const BASE_URL = 'https://api.openrouteservice.org/v2';

// Cache para evitar chamadas repetidas à API
const cacheDistancias = new Map<string, number>();

// ====================================
// FUNÇÕES DE DISTÂNCIA
// ====================================

// Matemática: Calcula distância em linha reta (Haversine) - MANTIDO como fallback
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// NOVO: Calcula distância real por ruas usando OpenRouteService
async function calcularDistanciaRealKm(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): Promise<number> {
  const chaveCache = `${lat1.toFixed(5)},${lon1.toFixed(5)}-${lat2.toFixed(5)},${lon2.toFixed(5)}`;
  
  // Verifica cache
  if (cacheDistancias.has(chaveCache)) {
    return cacheDistancias.get(chaveCache)!;
  }

  try {
    const response = await fetch(`${BASE_URL}/directions/driving-car`, {
      method: 'POST',
      headers: {
        'Authorization': OPENROUTE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [[lon1, lat1], [lon2, lat2]],
        preference: 'shortest', // CRÍTICO: menor distância
        units: 'km',
        geometry: false, // não precisamos da geometria aqui
        instructions: false
      })
    });

    if (!response.ok) {
      console.warn(`API retornou ${response.status}, usando Haversine como fallback`);
      return calcularDistanciaKm(lat1, lon1, lat2, lon2);
    }

    const data = await response.json();
    const distancia = data.routes[0].summary.distance / 1000; // metros para km
    
    // Salva no cache
    cacheDistancias.set(chaveCache, distancia);
    
    return distancia;
  } catch (error) {
    console.error('Erro ao calcular distância real:', error);
    // Fallback para Haversine se API falhar
    return calcularDistanciaKm(lat1, lon1, lat2, lon2);
  }
}

// NOVO: Calcula distância total de uma rota usando API (com batching para economia)
async function calcularDistanciaTotalRotaReal(rota: Customer[]): Promise<number> {
  if (rota.length < 2) return 0;

  // Prepara coordenadas
  const coords = rota
    .filter(c => c.latitude && c.longitude)
    .map(c => [c.longitude!, c.latitude!]);

  if (coords.length < 2) return 0;

  try {
    const response = await fetch(`${BASE_URL}/directions/driving-car`, {
      method: 'POST',
      headers: {
        'Authorization': OPENROUTE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        coordinates: coords,
        preference: 'shortest',
        units: 'km',
        geometry: false,
        instructions: false
      })
    });

    if (!response.ok) {
      throw new Error(`API retornou ${response.status}`);
    }

    const data = await response.json();
    return data.routes[0].summary.distance / 1000;
  } catch (error) {
    console.error('Erro ao calcular distância total, usando Haversine:', error);
    // Fallback
    let total = 0;
    for (let i = 0; i < rota.length - 1; i++) {
      const p1 = rota[i];
      const p2 = rota[i+1];
      if (p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
        total += calcularDistanciaKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      }
    }
    return total;
  }
}

// ====================================
// ALGORITMO 2-OPT (Adaptado para API)
// ====================================
async function refinarCom2Opt(rotaInicial: Customer[]): Promise<Customer[]> {
  let melhorRota = [...rotaInicial];
  let houveMelhora = true;
  let iteracoes = 0;
  const MAX_ITERACOES = 30; // Reduzido para evitar muitas chamadas à API

  while (houveMelhora && iteracoes < MAX_ITERACOES) {
    houveMelhora = false;
    const distanciaAtual = await calcularDistanciaTotalRotaReal(melhorRota);

    for (let i = 1; i < melhorRota.length - 2; i++) {
      for (let j = i + 1; j < melhorRota.length - 1; j++) {
        if (j - i === 1) continue;

        const novaRota = [
          ...melhorRota.slice(0, i),
          ...melhorRota.slice(i, j + 1).reverse(),
          ...melhorRota.slice(j + 1)
        ];

        const novaDistancia = await calcularDistanciaTotalRotaReal(novaRota);

        if (novaDistancia < distanciaAtual) {
          melhorRota = novaRota;
          houveMelhora = true;
          console.log(`✓ 2-Opt melhorou: ${distanciaAtual.toFixed(2)}km → ${novaDistancia.toFixed(2)}km`);
          break;
        }
      }
      if (houveMelhora) break;
    }
    iteracoes++;
  }

  return melhorRota;
}

// ====================================
// ROTA INICIAL (Vizinho Mais Próximo com API)
// ====================================
const gerarRotaInicial = async (
  pontoPartida: {lat: number, lng: number}, 
  grupo: Customer[]
): Promise<{ rota: Customer[], ultimoPonto: {lat: number, lng: number} }> => {
  const pendentes = [...grupo];
  const rota: Customer[] = [];
  let atual = pontoPartida;

  while (pendentes.length > 0) {
    let indexMaisProximo = -1;
    let menorDistancia = Infinity;

    // Calcula distância real para cada cliente pendente
    for (let i = 0; i < pendentes.length; i++) {
      if (pendentes[i].latitude && pendentes[i].longitude) {
        const dist = await calcularDistanciaRealKm(
          atual.lat, 
          atual.lng, 
          pendentes[i].latitude!, 
          pendentes[i].longitude!
        );
        
        if (dist < menorDistancia) {
          menorDistancia = dist;
          indexMaisProximo = i;
        }
      }
    }

    if (indexMaisProximo !== -1) {
      const encontrado = pendentes[indexMaisProximo];
      rota.push(encontrado);
      if (encontrado.latitude && encontrado.longitude) {
        atual = { lat: encontrado.latitude, lng: encontrado.longitude };
      }
      pendentes.splice(indexMaisProximo, 1);
    } else {
      if (pendentes.length > 0) {
        rota.push(pendentes[0]);
        pendentes.splice(0, 1);
      }
    }
  }

  return { rota, ultimoPonto: atual };
};

// ====================================
// FUNÇÃO PRINCIPAL (Assíncrona agora)
// ====================================
export const otimizarRota = async (
  pontoPartida: { lat: number, lng: number }, 
  clientes: Customer[]
): Promise<Customer[]> => {
  
  // Validação da API Key
  if (!OPENROUTE_API_KEY) {
    console.warn('⚠️ OPENROUTE_API_KEY não configurada! Usando Haversine (menos preciso)');
  }

  const comCoords = clientes.filter(c => c.latitude && c.longitude);
  const semCoords = clientes.filter(c => !c.latitude || !c.longitude);

  if (comCoords.length === 0) return clientes;

  // Limpa o cache a cada nova otimização
  cacheDistancias.clear();

  // 1. Agrupar clientes por Bairro
  const bairros: { [key: string]: Customer[] } = {};
  comCoords.forEach(c => {
    const nomeBairro = c.neighborhood ? c.neighborhood.trim().toUpperCase() : "GERAL";
    if (!bairros[nomeBairro]) bairros[nomeBairro] = [];
    bairros[nomeBairro].push(c);
  });

  let rotaFinal: Customer[] = [];
  let posicaoAtual = pontoPartida;
  const nomesBairros = Object.keys(bairros);

  console.log(`🚗 Otimizando rota para ${comCoords.length} clientes em ${nomesBairros.length} bairros...`);

  // 2. Processar bairro a bairro
  while (nomesBairros.length > 0) {
    let melhorBairroIndex = -1;
    let menorDistanciaBairro = Infinity;

    // Acha o bairro mais próximo usando distância REAL
    for (let i = 0; i < nomesBairros.length; i++) {
      const nome = nomesBairros[i];
      const grupo = bairros[nome];
      
      if (grupo[0].latitude && grupo[0].longitude) {
        const dist = await calcularDistanciaRealKm(
          posicaoAtual.lat, 
          posicaoAtual.lng, 
          grupo[0].latitude, 
          grupo[0].longitude
        );
        
        if (dist < menorDistanciaBairro) {
          menorDistanciaBairro = dist;
          melhorBairroIndex = i;
        }
      }
    }

    if (melhorBairroIndex !== -1) {
      const nomeBairroVencedor = nomesBairros[melhorBairroIndex];
      const clientesDoBairro = bairros[nomeBairroVencedor];

      console.log(`  📍 Processando bairro: ${nomeBairroVencedor} (${clientesDoBairro.length} clientes)`);

      // A) Gera rota inicial gulosa
      const resultadoInicial = await gerarRotaInicial(posicaoAtual, clientesDoBairro);
      
      // B) Refina com 2-Opt
      const rotaParaOtimizar = [
        { ...clientesDoBairro[0], latitude: posicaoAtual.lat, longitude: posicaoAtual.lng, id: 'start_point' },
        ...resultadoInicial.rota
      ];

      const rotaRefinada = await refinarCom2Opt(rotaParaOtimizar);
      rotaRefinada.shift(); // Remove ponto fantasma

      rotaFinal = [...rotaFinal, ...rotaRefinada];
      
      const ultimo = rotaRefinada[rotaRefinada.length - 1];
      if (ultimo && ultimo.latitude && ultimo.longitude) {
        posicaoAtual = { lat: ultimo.latitude, lng: ultimo.longitude };
      }

      nomesBairros.splice(melhorBairroIndex, 1);
    } else {
      nomesBairros.forEach(n => rotaFinal.push(...bairros[n]));
      break;
    }
  }

  // Calcula e exibe a distância total final
  const distanciaTotal = await calcularDistanciaTotalRotaReal(rotaFinal);
  console.log(`✅ Rota otimizada! Distância total: ${distanciaTotal.toFixed(2)} km`);

  return [...rotaFinal, ...semCoords];
};

// ====================================
// NOVA FUNÇÃO: Obter geometria completa da rota para visualização
// ====================================
export const obterGeometriaRota = async (rota: Customer[]): Promise<any> => {
  if (!OPENROUTE_API_KEY) {
    throw new Error('API Key não configurada');
  }

  const coords = rota
    .filter(c => c.latitude && c.longitude)
    .map(c => [c.longitude!, c.latitude!]);

  if (coords.length < 2) {
    throw new Error('É necessário pelo menos 2 pontos para traçar a rota');
  }

  try {
    const response = await fetch(`${BASE_URL}/directions/driving-car/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': OPENROUTE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json'
      },
      body: JSON.stringify({
        coordinates: coords,
        preference: 'shortest',
        units: 'km',
        instructions: true,
        elevation: false
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      geometria: data.features[0].geometry, // GeoJSON para desenhar no mapa
      distancia: (data.features[0].properties.summary.distance / 1000).toFixed(2),
      duracao: (data.features[0].properties.summary.duration / 60).toFixed(0),
      instrucoes: data.features[0].properties.segments[0]?.steps || []
    };
  } catch (error) {
    console.error('Erro ao obter geometria:', error);
    throw error;
  }
};
