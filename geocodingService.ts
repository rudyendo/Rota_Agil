// services/geocodingService.ts
// Serviço de Geocoding usando Nominatim (OpenStreetMap)
// GRATUITO - Sem API key necessária
// Limite: 1 requisição por segundo (respeitamos isso no código)

interface Coordenadas {
  lat: number;
  lng: number;
}

// Controle de rate limit (1 req/segundo)
let ultimaRequisicao = 0;
const DELAY_MIN = 1000; // 1 segundo entre requisições

async function aguardarRateLimit() {
  const agora = Date.now();
  const tempoDecorrido = agora - ultimaRequisicao;
  
  if (tempoDecorrido < DELAY_MIN) {
    const aguardar = DELAY_MIN - tempoDecorrido;
    await new Promise(resolve => setTimeout(resolve, aguardar));
  }
  
  ultimaRequisicao = Date.now();
}

/**
 * Busca coordenadas usando Nominatim (OpenStreetMap)
 * GRATUITO e sem necessidade de API key
 */
export async function buscarCoordenadas(
  endereco: string,
  cidade: string = 'Natal',
  estado: string = 'RN',
  pais: string = 'Brasil'
): Promise<Coordenadas | null> {
  
  // Aguarda para respeitar rate limit
  await aguardarRateLimit();
  
  // Monta o endereço completo
  const enderecoCompleto = `${endereco}, ${cidade}, ${estado}, ${pais}`;
  
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', enderecoCompleto);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', '1');
    url.searchParams.append('addressdetails', '1');
    
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'RotaAgil/1.0' // Nominatim requer User-Agent
      }
    });
    
    if (!response.ok) {
      console.warn(`Nominatim retornou ${response.status} para: ${endereco}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const resultado = data[0];
      console.log(`✅ Coordenadas encontradas para ${endereco}:`, resultado.lat, resultado.lon);
      
      return {
        lat: parseFloat(resultado.lat),
        lng: parseFloat(resultado.lon)
      };
    }
    
    console.warn(`⚠️ Nenhuma coordenada encontrada para: ${endereco}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Erro ao buscar coordenadas para ${endereco}:`, error);
    return null;
  }
}

/**
 * Geocodifica múltiplos endereços em lote
 * Respeita automaticamente o rate limit de 1 req/segundo
 */
export async function buscarCoordenadasEmLote(
  enderecos: Array<{
    endereco: string;
    cidade?: string;
    estado?: string;
  }>,
  onProgress?: (atual: number, total: number, endereco: string) => void
): Promise<Array<Coordenadas | null>> {
  
  const resultados: Array<Coordenadas | null> = [];
  
  for (let i = 0; i < enderecos.length; i++) {
    const { endereco, cidade, estado } = enderecos[i];
    
    if (onProgress) {
      onProgress(i + 1, enderecos.length, endereco);
    }
    
    const coords = await buscarCoordenadas(endereco, cidade, estado);
    resultados.push(coords);
  }
  
  return resultados;
}

/**
 * Valida se coordenadas estão dentro do Brasil (validação básica)
 */
export function coordenadasNoBrasil(lat: number, lng: number): boolean {
  // Brasil: lat entre -33 e 5, lng entre -74 e -34
  return lat >= -34 && lat <= 6 && lng >= -75 && lng <= -34;
}

/**
 * Calcula distância aproximada entre duas coordenadas (em km)
 * Útil para validar se o geocoding retornou algo próximo
 */
export function calcularDistancia(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * FALLBACK: Se Nominatim falhar, tenta com Google Geocoding
 * (Requer API key, mas tem quota gratuita de 40k req/mês)
 */
export async function buscarCoordenadasGoogle(
  endereco: string,
  cidade: string = 'Natal',
  estado: string = 'RN'
): Promise<Coordenadas | null> {
  
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!GOOGLE_API_KEY) {
    console.warn('Google Maps API key não configurada');
    return null;
  }
  
  const enderecoCompleto = `${endereco}, ${cidade}, ${estado}, Brasil`;
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(enderecoCompleto)}&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro no Google Geocoding:', error);
    return null;
  }
}
