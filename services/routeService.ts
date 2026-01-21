// services/routeService.ts
import { Customer } from '../types';

// --- Matemática: Calcula distância real na Terra (Fórmula de Haversine) ---
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

// Auxiliar: Calcula a distância total de um trajeto inteiro
function calcularDistanciaTotalRota(rota: Customer[]): number {
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

// --- O CÉREBRO: Algoritmo 2-Opt ---
// Ele pega uma rota e tenta "desembaraçar" os nós trocando posições
function refinarCom2Opt(rotaInicial: Customer[]): Customer[] {
  let melhorRota = [...rotaInicial];
  let houveMelhora = true;
  let iteracoes = 0;
  const MAX_ITERACOES = 50; // Limite para não travar o navegador se tiver muitos clientes

  while (houveMelhora && iteracoes < MAX_ITERACOES) {
    houveMelhora = false;
    const distanciaAtual = calcularDistanciaTotalRota(melhorRota);

    // Tenta trocar dois pontos da rota e vê se fica mais curto
    for (let i = 1; i < melhorRota.length - 2; i++) {
      for (let j = i + 1; j < melhorRota.length - 1; j++) {
        if (j - i === 1) continue; // Pula vizinhos imediatos

        // Cria uma nova rota invertendo o trecho entre i e j
        const novaRota = [
          ...melhorRota.slice(0, i),
          ...melhorRota.slice(i, j + 1).reverse(),
          ...melhorRota.slice(j + 1)
        ];

        const novaDistancia = calcularDistanciaTotalRota(novaRota);

        // Se achou um caminho mais curto, adota ele
        if (novaDistancia < distanciaAtual) {
          melhorRota = novaRota;
          houveMelhora = true;
          break; // Reinicia o loop para otimizar a nova rota
        }
      }
      if (houveMelhora) break;
    }
    iteracoes++;
  }

  return melhorRota;
}

// --- Rota Inicial (Vizinho Mais Próximo) ---
// Cria um esboço rápido da rota antes de otimizar
const gerarRotaInicial = (pontoPartida: {lat: number, lng: number}, grupo: Customer[]): { rota: Customer[], ultimoPonto: {lat: number, lng: number} } => {
  const pendentes = [...grupo];
  const rota: Customer[] = [];
  let atual = pontoPartida;

  while (pendentes.length > 0) {
    let indexMaisProximo = -1;
    let menorDistancia = Infinity;

    for (let i = 0; i < pendentes.length; i++) {
      if (pendentes[i].latitude && pendentes[i].longitude) {
        const dist = calcularDistanciaKm(atual.lat, atual.lng, pendentes[i].latitude!, pendentes[i].longitude!);
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
      // Segurança para dados corrompidos
      if (pendentes.length > 0) {
        rota.push(pendentes[0]);
        pendentes.splice(0, 1);
      }
    }
  }

  return { rota, ultimoPonto: atual };
};

// --- Função Principal Exportada ---
export const otimizarRota = (
  pontoPartida: { lat: number, lng: number }, 
  clientes: Customer[]
): Customer[] => {
  
  const comCoords = clientes.filter(c => c.latitude && c.longitude);
  const semCoords = clientes.filter(c => !c.latitude || !c.longitude);

  if (comCoords.length === 0) return clientes;

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

  // 2. Processar bairro a bairro
  while (nomesBairros.length > 0) {
    // Acha o bairro mais próximo da posição atual
    let melhorBairroIndex = -1;
    let menorDistanciaBairro = Infinity;

    for (let i = 0; i < nomesBairros.length; i++) {
      const nome = nomesBairros[i];
      const grupo = bairros[nome];
      // Usa o primeiro cliente do bairro como referência
      if (grupo[0].latitude && grupo[0].longitude) {
        const dist = calcularDistanciaKm(posicaoAtual.lat, posicaoAtual.lng, grupo[0].latitude, grupo[0].longitude);
        if (dist < menorDistanciaBairro) {
          menorDistanciaBairro = dist;
          melhorBairroIndex = i;
        }
      }
    }

    if (melhorBairroIndex !== -1) {
      const nomeBairroVencedor = nomesBairros[melhorBairroIndex];
      const clientesDoBairro = bairros[nomeBairroVencedor];

      // A) Gera rota inicial gulosa
      const resultadoInicial = gerarRotaInicial(posicaoAtual, clientesDoBairro);
      
      // B) Refina com 2-Opt (Otimização)
      // Adicionamos um "ponto fantasma" (posição atual) no início para o algoritmo saber de onde viemos
      const rotaParaOtimizar = [
        { ...clientesDoBairro[0], latitude: posicaoAtual.lat, longitude: posicaoAtual.lng, id: 'start_point' },
        ...resultadoInicial.rota
      ];

      const rotaRefinada = refinarCom2Opt(rotaParaOtimizar);
      
      // Removemos o ponto fantasma
      rotaRefinada.shift();

      rotaFinal = [...rotaFinal, ...rotaRefinada];
      
      // Atualiza a posição para o último ponto visitado
      const ultimo = rotaRefinada[rotaRefinada.length - 1];
      if (ultimo && ultimo.latitude && ultimo.longitude) {
        posicaoAtual = { lat: ultimo.latitude, lng: ultimo.longitude };
      }

      nomesBairros.splice(melhorBairroIndex, 1);
    } else {
      // Fallback
      nomesBairros.forEach(n => rotaFinal.push(...bairros[n]));
      break;
    }
  }

  // Adiciona no final quem não tem coordenadas
  return [...rotaFinal, ...semCoords];
};
