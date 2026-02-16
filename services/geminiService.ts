
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { ImageSize } from "../types";
import { PENCIL_SKETCH_MODIFIER } from "../constants";

// Manual base64 decoding as per guidelines
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual base64 encoding as per guidelines
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to create a WAV header for 24kHz Mono 16-bit PCM
function createWavHeader(pcmDataLength: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmDataLength, true); // file size
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // subchunk1size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmDataLength, true);

  return new Uint8Array(header);
}

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const analyzeScript = async (script: string): Promise<any[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze this script and break it into sequential scenes for a storyboard. For each scene, provide a descriptive action summary and dialogue. 
    Script: ${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            order: { type: Type.INTEGER },
            description: { type: Type.STRING, description: "Detailed visual description of the scene for an artist" },
            dialogue: { type: Type.STRING, description: "Spoken lines in this scene" }
          },
          required: ["order", "description", "dialogue"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const generateStoryboardImage = async (prompt: string, size: ImageSize): Promise<string> => {
  const ai = getAI();
  const fullPrompt = `${PENCIL_SKETCH_MODIFIER} ${prompt}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: fullPrompt }] },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: size
      }
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) {
    return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("No image data returned from Gemini");
};

export const generateSceneVideo = async (prompt: string, initialImageBase64?: string): Promise<string> => {
  const ai = getAI();
  const fullPrompt = `${PENCIL_SKETCH_MODIFIER} ${prompt}. Maintain rough pencil sketch style with charcoal textures. Animation should be fluid but look like moving sketches.`;
  
  const payload: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: fullPrompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  };

  if (initialImageBase64) {
    payload.image = {
      imageBytes: initialImageBase64.split(',')[1],
      mimeType: 'image/png'
    };
  }

  let operation = await ai.models.generateVideos(payload);
  
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed: no download link");

  const res = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

export const generateDialogueSpeech = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this dialogue naturally as the character: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");
  
  const pcmBytes = decode(base64Audio);
  const wavHeader = createWavHeader(pcmBytes.length);
  const wavBlob = new Blob([wavHeader, pcmBytes], { type: 'audio/wav' });
  return URL.createObjectURL(wavBlob);
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: 'audio/webm' } },
        { text: "Transcribe this audio clip accurately." }
      ]
    }
  });
  return response.text || "";
};

export const chatWithGemini = async (messages: any[]): Promise<string> => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "You are SketchFlow Assistant, a helpful AI specialized in scriptwriting, storyboarding, and animation. You help users refine their creative projects. Focus on visual descriptions and storytelling.",
    }
  });
  
  const lastMsg = messages[messages.length - 1];
  const response = await chat.sendMessage({ message: lastMsg.text });
  return response.text || "Sorry, I couldn't process that.";
};
