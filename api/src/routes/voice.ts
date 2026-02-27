import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { VoiceService } from '../services/VoiceService';
import { VoiceCommand } from '../types';
import * as path from 'path';

const router = Router();
const voiceService = new VoiceService();

// Extend Request type to include file property
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Configure multer for audio file uploads
 * Requirements: 1.1, 1.5
 */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req: Request, file: any, cb: FileFilterCallback) => {
    // Validate audio file format (WAV/MP3)
    const allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav'];
    const allowedExtensions = ['.wav', '.mp3'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    if (allowedMimeTypes.includes(mimeType) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only WAV and MP3 files are allowed.'));
    }
  },
});

/**
 * POST /api/voice
 * Default route - analyze text command (for testing)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, userId, audioData } = req.body;

    // If text provided, use text analysis
    if (text || audioData) {
      const mockResult = {
        transcript: text || 'Mock voice command',
        intent: extractIntentFromText(text || 'scout NFTs'),
        emotion: {
          confidence: 0.8,
          urgency: 0.5,
        },
        fraudScore: 0.1,
        approved: true,
        timestamp: new Date().toISOString(),
      };

      return res.json(mockResult);
    }

    return res.status(400).json({
      error: 'No input provided',
      message: 'Please provide text or audioData',
    });
  } catch (error) {
    console.error('Voice analysis error:', error);
    res.status(500).json({
      error: 'Voice analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/voice/analyze
 * Analyze voice command with fraud detection and intent extraction
 * Requirements: 1.1, 1.5
 */
router.post('/analyze', upload.single('audio'), async (req: MulterRequest, res: Response) => {
  try {
    // Validate request
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        message: 'Please upload an audio file (WAV or MP3 format)',
      });
    }

    const userId = req.body.userId || req.query.userId || 'demo-user-1';

    // Create voice command
    const command: VoiceCommand = {
      audio: req.file.buffer,
      userId: userId as string,
    };

    // Analyze voice command
    const result = await voiceService.analyzeVoiceCommand(command);

    // Return analysis result
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Voice analysis error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid file format')) {
        return res.status(400).json({
          error: 'Invalid file format',
          message: error.message,
        });
      }
      
      if (error.message.includes('MODULATE_API_KEY')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Voice analysis service is not configured. Using fallback mode.',
        });
      }
    }

    res.status(500).json({
      error: 'Voice analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * POST /api/voice/analyze-text
 * Analyze text command (for testing without audio file)
 * Requirements: 1.1, 1.4
 */
router.post('/analyze-text', async (req: Request, res: Response) => {
  try {
    const { text, userId } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'No text provided',
        message: 'Please provide a text command',
      });
    }

    // Create a mock voice command with text transcript
    const mockResult = {
      transcript: text,
      intent: extractIntentFromText(text),
      emotion: {
        confidence: 0.8,
        urgency: 0.5,
      },
      fraudScore: 0.1,
      approved: true,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: mockResult,
      note: 'Text-based analysis (no audio processing)',
    });
  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({
      error: 'Text analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/voice/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'voice',
    modulateConfigured: !!process.env.MODULATE_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Helper function to extract intent from text
 * Requirements: 1.4
 */
function extractIntentFromText(text: string): any {
  const lower = text.toLowerCase();

  // Determine action
  let action: 'scout' | 'buy' | 'sell' | 'query' = 'query';
  if (lower.includes('scout') || lower.includes('search') || lower.includes('find')) {
    action = 'scout';
  } else if (lower.includes('buy') || lower.includes('purchase')) {
    action = 'buy';
  } else if (lower.includes('sell')) {
    action = 'sell';
  }

  // Determine asset type
  let assetType: 'nft' | 'token' | 'any' = 'any';
  if (lower.includes('nft')) {
    assetType = 'nft';
  } else if (lower.includes('token')) {
    assetType = 'token';
  }

  // Extract price limit
  let priceLimit: number | undefined;
  const priceMatch = lower.match(/(?:under|below|less than|max)\s+(\d+(?:\.\d+)?)/);
  if (priceMatch) {
    priceLimit = parseFloat(priceMatch[1]);
  }

  // Determine risk preference
  let riskPreference: 'low' | 'medium' | 'high' = 'medium';
  if (lower.includes('low risk') || lower.includes('safe') || lower.includes('conservative')) {
    riskPreference = 'low';
  } else if (lower.includes('high risk') || lower.includes('aggressive')) {
    riskPreference = 'high';
  }

  return {
    action,
    assetType,
    priceLimit,
    riskPreference,
  };
}

export default router;
