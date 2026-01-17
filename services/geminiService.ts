
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  try {
    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: `Você é um robô de extração de dados especializado em tabelas de rotas comerciais. 
      Analise o arquivo anexo meticulosamente. 
      
      ESTRUTURA ESPERADA:
      Existem colunas para Ordem, Cliente, Endereço, Bairro, Cidade, Estado, País, Telefone e Status.
      
      MISSÃO:
      Extraia CADA LINHA da tabela como um objeto JSON. Não pule nenhuma linha, mesmo que pareça repetitiva.
      Se o documento tiver várias páginas, processe todas elas.
      
      Retorne uma lista JSON pura seguindo o schema informado.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Mudado para Pro para melhor detecção de tabelas em PDF
      contents: { parts: [filePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro na extração de arquivo:", error);
    throw error;
  }
};

export const parseRawTextToCustomers = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transforme o texto abaixo em uma lista de clientes JSON. 
      O texto veio de um OCR de tabela. Identifique as colunas de Nome, Endereço e Telefone corretamente.
      
      Texto:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro no processamento de texto:", error);
    throw error;
  }
};

export const optimizeRouteOrder = async (addresses: string[]) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um roteirizador logístico. Ordene estes endereços de entrega para percorrer a menor distância total:
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
  } catch (error) {
    console.error("Erro na otimização:", error);
    return addresses;
  }
};
