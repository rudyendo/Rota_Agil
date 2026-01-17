
import { GoogleGenAI, Type } from "@google/genai";

// Schema for customer data extraction
const customerSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nome completo do cliente" },
      address: { type: Type.STRING, description: "Endereço completo (Rua, Número, etc.)" },
      neighborhood: { type: Type.STRING, description: "Bairro" },
      city: { type: Type.STRING, description: "Cidade" },
      state: { type: Type.STRING, description: "Estado" },
      phone: { type: Type.STRING, description: "Telefone de contato" },
      status: { type: Type.STRING, description: "Observação de status" }
    },
    required: ["name"]
  }
};

/**
 * Parses a file (image, PDF, etc.) to extract customer information using Gemini.
 */
export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  try {
    // Creating instance inside the function to ensure the latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: `Você é um robô de extração de dados especializado em tabelas de rotas comerciais. 
      Extraia CADA LINHA da tabela como um objeto JSON. Não pule nenhuma linha.
      Retorne uma lista JSON pura.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [filePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro na extração:", error);
    throw error;
  }
};

/**
 * Parses raw text to extract customer information using Gemini.
 */
export const parseRawTextToCustomers = async (text: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transforme o texto em JSON de clientes: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro no texto:", error);
    throw error;
  }
};

/**
 * Optimizes a list of addresses for the best delivery route.
 */
export const optimizeRouteOrder = async (addresses: string[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Ordene estes endereços para a melhor rota: ${addresses.join('\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro na otimização:", error);
    return addresses;
  }
};
