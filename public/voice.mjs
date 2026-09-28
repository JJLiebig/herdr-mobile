import { MAX_AUDIO, MAX_RECORDING_MS } from '../shared/model.mjs';
/** Browser recording with a frozen destination and explicit, cancellable uploads. */
export class VoiceRecorder {
  constructor({onState,onText}){this.onState=onState;this.onText=onText;this.generation=0;this.phase='idle';this.blob=null;this.active=false;}
  state(phase,message=''){this.phase=phase;this.onState({phase,message,elapsed:this.startedAt?Math.floor((Date.now()-this.startedAt)/1000):0});}
  async record(binding){
    if(this.active)return;
    this.cancel();this.binding={...binding};this.active=true;const generation=this.generation;
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){this.active=false;this.state('error','Recording requires HTTPS and browser microphone support. Keyboard dictation remains available.');return;}
    this.state('permission','Allow microphone access.');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;const types=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];const type=types.find(t=>MediaRecorder.isTypeSupported(t));
      if(!type)throw new Error('No supported recording format. Use keyboard dictation.');
      const recorder=new MediaRecorder(stream,{mimeType:type,audioBitsPerSecond:64000});this.recorder=recorder;this.chunks=[];let size=0;
      recorder.ondataavailable=event=>{if(generation!==this.generation)return;size+=event.data.size;if(size>MAX_AUDIO){this.cancel();this.state('error','Recording exceeded 8 MB and was discarded.');return;}if(event.data.size)this.chunks.push(event.data);};
      recorder.onerror=()=>{this.cancel();this.state('error','Recording failed. Please try again.');};
      recorder.onstop=()=>{
        clearInterval(this.clock);stream.getTracks().forEach(t=>t.stop());
        if(generation!==this.generation)return;
        this.blob=new Blob(this.chunks,{type:recorder.mimeType});this.chunks=[];this.recorder=null;this.stream=null;this.active=false;this.state('recorded','Recording ready. Transcribe sends this audio to OpenAI.');
      };
      recorder.start(1000);this.startedAt=Date.now();this.state('recording');
      this.clock=setInterval(()=>{if(Date.now()-this.startedAt>=MAX_RECORDING_MS)this.stop();else this.state('recording');},500);
    }catch(error){if(generation!==this.generation)return;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.active=false;this.state('error',error.name==='NotAllowedError'?'Microphone permission denied. Use keyboard dictation or change browser permissions.':error.message);}
  }
  stop(){if(this.recorder?.state==='recording'){this.recorder.stop();clearInterval(this.clock);}}
  async transcribe(){
    if(!this.blob || this.phase==='transcribing')return;
    const generation=this.generation;this.controller=new AbortController();this.state('transcribing','Sending recording to OpenAI…');
    try{
      const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':this.blob.type,'X-Herdr-Mobile':'1','X-Audio-Consent':'openai'},body:this.blob,signal:this.controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.message||'Transcription failed');
      if(generation!==this.generation)return;
      this.onText(this.binding,data.text);this.blob=null;this.startedAt=null;this.state('idle','Transcript added for review. Nothing was sent to the agent.');
    }catch(error){if(generation===this.generation)this.state('error',error.message+' Your recording is retained for explicit retry.');}
    finally{if(generation===this.generation)this.controller=null;}
  }
  cancel(){this.generation++;this.controller?.abort();this.controller=null;clearInterval(this.clock);if(this.recorder?.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.recorder=null;this.chunks=[];this.blob=null;this.active=false;this.startedAt=null;this.state('idle');}
}
