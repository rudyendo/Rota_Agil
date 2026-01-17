
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
 * Inicializa o cliente AI usando a variável de ambiente padrão process.env.API_KEY.
 * Esta é a única forma suportada para injeção automática de chaves nesta plataforma.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_NOT_FOUND");
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
        { text: "Extraia todos os clientes desta imagem/documento para JSON. Nome, endereço, bairro e telefone." }
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
    contents: `Transforme o seguinte texto em uma lista de clientes JSON: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text || "[]");
};
