
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
 * Inicializa o cliente AI.
 * Utiliza GOOGLE_GENERATIVE_AI_API_KEY conforme solicitado.
 */
const getAiClient = () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extraia todos os clientes desta imagem/documento para JSON. Inclua nome, endereço, bairro e telefone se disponíveis." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    throw error;
  }
};

export const parseRawTextToCustomers = async (text: string) => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transforme o seguinte texto em uma lista de clientes JSON: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    throw error;
  }
};

export const optimizeRouteOrder = async (addresses: string[]) => {
  try {
    const ai = getAiClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um GPS inteligente. Reordene estes endereços para o MENOR caminho possível.
      O primeiro endereço é onde eu estou agora (ORIGEM).
      Retorne apenas a lista de endereços em ordem, um por linha.
      
      ENDEREÇOS:
      ${addresses.join('\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    throw error;
  }
};
