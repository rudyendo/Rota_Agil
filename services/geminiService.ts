
import { GoogleGenAI, Type } from "@google/genai";

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

/**
 * Inicializa o cliente AI garantindo o uso da API_KEY do ambiente ou do seletor.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Chave de API não configurada no ambiente.");
  }
  return new GoogleGenAI({ apiKey });
};

export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: "Extraia cada linha da tabela como JSON. Não pule ninguém." }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text || "[]");
};

export const parseRawTextToCustomers = async (text: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Transforme em JSON: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text || "[]");
};

export const optimizeRouteOrder = async (addresses: string[]) => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Você é um especialista em logística de última milha (Last Mile).
    Sua tarefa é REORDENAR a lista para o MENOR PERCURSO GERAL.

    REGRAS DE OTIMIZAÇÃO:
    1. O primeiro item é a ORIGEM (GPS). Mantenha-o no topo.
    2. Agrupe endereços por PROXIMIDADE RADICAL (mesma rua > mesmo bairro > bairro vizinho).
    3. Trace uma rota "circular" ou "em arco". O vendedor nunca deve ir para o Norte e depois para o Sul se houver pontos intermediários.
    4. Ignore erros de digitação leves e foque na lógica geográfica das ruas citadas.

    DADOS (Origem + Destinos):
    ${addresses.join('\n')}`,
    config: {
      thinkingConfig: { thinkingBudget: 15000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
  });
  
  return JSON.parse(response.text || "[]");
};
