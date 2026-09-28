import { HttpError } from './security.mjs';
import { MAX_AUDIO } from '../shared/model.mjs';
const formats=new Map([['audio/webm','webm'],['video/webm','webm'],['audio/ogg','ogg'],['audio/mp4','m4a'],['audio/wav','wav'],['audio/x-wav','wav']]);
export class TranscriptionService {
  constructor(cfg,fetcher=fetch){this.cfg=cfg;this.fetcher=fetcher;this.active=0;this.requests=[];}
  async transcribe(bytes,type,signal) {
    if(!this.cfg.apiKey)throw new HttpError(503,'voice_not_configured');
    const mime=type.split(';')[0].trim().toLowerCase();const extension=formats.get(mime);
    if(!extension)throw new HttpError(415,'unsupported_audio_format');
    if(!bytes.length || bytes.length>MAX_AUDIO)throw new HttpError(413,'invalid_audio_size');
    const now=Date.now();this.requests=this.requests.filter(t=>now-t<3600000);
    if(this.active>=2 || this.requests.length>=30)throw new HttpError(429,'voice_rate_limit');
    this.requests.push(now);this.active++;
    try {
      const form=new FormData();form.append('file',new Blob([bytes],{type:mime}),`recording.${extension}`);form.append('model',this.cfg.transcriptionModel);form.append('response_format','json');
      const response=await this.fetcher('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${this.cfg.apiKey}`},body:form,signal:AbortSignal.any([signal || new AbortController().signal,AbortSignal.timeout(60000)])});
      if(!response.ok)throw new HttpError(502,'transcription_provider_failed','Transcription failed. Your recording can be retried explicitly.');
      const body=await response.json();
      if(typeof body.text!=='string' || body.text.length>16000)throw new HttpError(502,'invalid_transcription_response');
      return {text:body.text,provider:'OpenAI',model:this.cfg.transcriptionModel};
    }catch(error){if(error instanceof HttpError)throw error;throw new HttpError(502,'transcription_unavailable');}
    finally{this.active--;}
  }
}
