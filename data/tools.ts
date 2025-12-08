
import { FunctionDeclaration, Type, Tool } from '@google/genai';

const setExpressionTool: FunctionDeclaration = {
  name: 'set_expression',
  description: 'Set the facial expression of the avatar based on the emotion of the conversation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: 'The expression name',
        enum: ['angry', 'confused', 'embarrassed', 'neutral', 'sleepy', 'sad', 'surprised', 'worried', 'smile']
      }
    },
    required: ['expression']
  }
};

const getWeatherTool: FunctionDeclaration = {
  name: 'get_weather',
  description: 'Get the current weather and temperature. ONLY use this if the user EXPLICITLY asks about weather.',
  parameters: {
    type: Type.OBJECT,
    properties: {
        city: {
            type: Type.STRING,
            description: "The city name if specified by the user, otherwise leave blank to use the current location."
        }
    },
    required: [] // Added back to ensure strict schema validation compliance
  }
};

export const TOOLS: Tool[] = [
  { functionDeclarations: [setExpressionTool, getWeatherTool] }
];
