import { GoogleGenAI, Type } from "@google/genai";

// --- Schema original de Clientes (Mantido) ---
const customerSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nome completo do cliente" },
      address: { type: Type.STRING, description: "Endereço completo" },
      neighborhood: { type: Type.STRING, description: "Bairro" },
      city: { type: Type.STRING, description: "Cidade" },
      state: { type: Type.STRING, description: "Estado" },
      phone: { type: Type.STRING, description: "Telefone" },
      status: { type: Type.STRING, description: "Status" }
    },
    required: ["name"]
  }
};

// --- Novo Schema para Coordenadas (Adicionado) ---
const coordinateSchema = {
  type: Type.OBJECT,
  properties: {
    lat: { type: Type.NUMBER, description: "Latitude geográfica" },
    lng: { type: Type.NUMBER, description: "Longitude geográfica" }
  },
  required: ["lat", "lng"]
};

/**
 * Inicializa o cliente AI
 */
const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY; // Adicionei suporte ao Vite também
  if (!apiKey) {
    throw new Error("API_KEY_NOT_FOUND");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Funções Originais (Mantidas) ---

export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash", // Atualizei para uma versão estável e rápida
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: "Extraia todos os clientes desta imagem/documento para JSON. Nome, endereço, bairro e telefone." }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text() || "[]");
};

export const parseRawTextToCustomers = async (text: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Transforme o seguinte texto em uma lista de clientes JSON: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text() || "[]");
};

// --- Nova Função: Obter Coordenadas (Adicionada) ---

export const getCoordinates = async (address: string, city: string = "Natal", state: string = "RN") => {
  const ai = getAiClient();
  
  // Montamos um prompt específico para geolocalização
  const prompt = `
    Aja como um serviço de geocodificação.
    Retorne a latitude e longitude exata para o endereço:
    "${address}, ${city} - ${state}, Brasil".
    
    Se não encontrar o número exato, retorne as coordenadas do centro da rua ou do bairro.
    Responda apenas com o JSON definido.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Modelo rápido ideal para muitas chamadas
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: coordinateSchema,
      },
    });

    const data = JSON.parse(response.text() || "{}");

    // Validação extra para garantir que recebemos números
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      return { lat: data.lat, lng: data.lng };
    }
    return null;

  } catch (error) {
    console.error(`Erro ao buscar coordenadas para ${address}:`, error);
    return null;
  }
};
