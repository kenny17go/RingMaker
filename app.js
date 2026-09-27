'use strict';
const $=id=>document.getElementById(id);
const state={buffer:null,ctx:null,source:null,previewTimer:null,objectURL:null,file:null,busy:false};
const sec=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}.${Math.round((t%1)*10)}`;
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
function notice(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('toast').hidden=true,4800)}
function trimSettings(){let b=state.buffer;const length=Number($('length').value),start=clamp(Number($('start').value),0,Math.max(0,b.duration-length));return {start,length,end:start+length,fade:$('fade').checked,volume:Number($('volume').value)/100}}
function drawWave(){const c=$('wave'),box=c.getBoundingClientRect(),width=Math.max(1,Math.round(box.width*devicePixelRatio)),height=Math.round(box.height*devicePixelRatio);c.width=width;c.height=height;const g=c.getContext('2d');g.clearRect(0,0,width,height);g.fillStyle='#8baded';const data=state.buffer.getChannelData(0),step=Math.max(1,Math.floor(data.length/width)),middle=height/2;for(let x=0;x<width;x+=Math.max(2,Math.round(devicePixelRatio*2))){let max=0,start=Math.floor(x*data.length/width);for(let j=start;j<Math.min(data.length,start+step);j+=Math.max(1,Math.floor(step/30)))max=Math.max(max,Math.abs(data[j]));const bar=Math.max(2,max*(height*.9));g.fillRect(x,middle-bar/2,Math.max(1,devicePixelRatio*1.2),bar)}updateOverlay()}
function updateOverlay(){
 if(!state.buffer)return;
 const s=trimSettings(),duration=state.buffer.duration;
 $('waveOverlay').style.left=(s.start/duration*100)+'%';
 $('waveOverlay').style.width=(s.length/duration*100)+'%';
 $('startValue').textContent=sec(s.start);
 $('lengthValue').textContent=s.length.toFixed(1)+' 秒';
 $('durationLabel').textContent=s.length.toFixed(1)+' 秒';
 $('endValue').textContent=sec(s.end);
 $('selectionTimes').textContent='從 '+sec(s.start)+' 到 '+sec(s.end);
 $('waveStartHandle').style.left=(s.start/duration*100)+'%';
 $('waveEndHandle').style.left=(s.end/duration*100)+'%';
 $('waveStartLabel').style.left=clamp(s.start/duration*100,10,90)+'%';
 $('waveEndLabel').style.left=clamp(s.end/duration*100,10,90)+'%';
 $('waveStartLabel').textContent=sec(s.start);
 $('waveEndLabel').textContent=sec(s.end);
 updatePreviewProgress();
}
// Native HTMLAudioElement is more reliable for audible playback on iOS Safari than
// starting Web Audio from a suspended AudioContext created during file import.
let previewAudio=null,previewURL=null,previewPosition=0,previewAnimation=0,previewInterval=0;
function updatePreviewProgress(){
 if(!state.buffer)return;
 const s=trimSettings();
 const live=previewAudio&&!previewAudio.paused&&Number.isFinite(previewAudio.currentTime)?previewAudio.currentTime:previewPosition;
 const pos=clamp(live,0,s.length);
 const slider=$('previewSeek');
 slider.max=s.length.toFixed(1);
 slider.value=pos.toFixed(1);
 slider.style.setProperty('--played', (s.length>0?pos/s.length*100:0).toFixed(1)+'%');
 $('previewCurrent').textContent=sec(pos);
 $('previewTotal').textContent=sec(s.length);
 $('previewPlayhead').style.left=((s.start+pos)/state.buffer.duration*100)+'%';
 $('previewPlayhead').hidden=false;
 $('previewPlayhead').style.display='block';
 $('wavePlaybackTime').textContent='播放：'+sec(s.start+pos);
}
function previewTick(){
 if(!previewAudio||previewAudio.paused){previewAnimation=0;return}
 previewPosition=previewAudio.currentTime||0;
 updatePreviewProgress();
 previewAnimation=requestAnimationFrame(previewTick);
}
function stopPreview(){
 if(previewAnimation){cancelAnimationFrame(previewAnimation);previewAnimation=0}
 if(previewInterval){clearInterval(previewInterval);previewInterval=0}
 if(previewAudio){
  previewAudio.onended=null;previewAudio.onerror=null;previewAudio.ontimeupdate=null;previewAudio.onloadedmetadata=null;
  previewAudio.pause();previewAudio.removeAttribute('src');previewAudio.load();previewAudio=null;
 }
 if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null}
 if(state.source){try{state.source.stop()}catch{}try{state.source.disconnect()}catch{}state.source=null}
 previewPosition=0;
 $('preview').textContent='▶ 試聽片段';$('preview').disabled=false;$('stop').disabled=true;
 updatePreviewProgress();
}
function seekPreview(position){
 if(!state.buffer)return;
 const s=trimSettings();
 previewPosition=clamp(position,0,s.length);
 if(previewAudio&&previewAudio.readyState>=1){
  try{previewAudio.currentTime=previewPosition}catch(e){console.warn('seek pending',e)}
 }
 updatePreviewProgress();
}
function skipPreview(delta){seekPreview(previewPosition+delta)}
function preview(){
 if(!state.buffer){notice('請先選擇音樂');return}
 if(previewAudio){
  if(previewAudio.paused){
   if(previewPosition>=trimSettings().length-.1)seekPreview(0);
   const result=previewAudio.play();
   $('preview').textContent='Ⅱ 暫停試聽';
   if(result&&result.catch)result.catch(e=>{ $('preview').textContent='▶ 繼續試聽';notice('無法播放：'+(e.message||e.name))});
  }else{
   previewPosition=previewAudio.currentTime;
   previewAudio.pause();$('preview').textContent='▶ 繼續試聽';
  }
  updatePreviewProgress();return;
 }
 try{
  const wav=writeWav(clipPCM());
  previewURL=URL.createObjectURL(wav);
  const audio=new Audio();
  audio.preload='auto';audio.playsInline=true;audio.src=previewURL;previewAudio=audio;
  audio.onloadedmetadata=()=>{if(previewAudio===audio&&previewPosition>0)seekPreview(previewPosition)};
  audio.ontimeupdate=()=>{if(previewAudio===audio){previewPosition=audio.currentTime;updatePreviewProgress()}};
  audio.onplay=()=>{if(previewAudio===audio){$('preview').textContent='Ⅱ 暫停試聽';if(!previewAnimation)previewAnimation=requestAnimationFrame(previewTick);if(!previewInterval)previewInterval=setInterval(()=>{if(previewAudio&&!previewAudio.paused){previewPosition=previewAudio.currentTime;updatePreviewProgress()}},100)}};
  audio.onpause=()=>{if(previewAudio===audio){previewPosition=audio.currentTime;if(previewAnimation){cancelAnimationFrame(previewAnimation);previewAnimation=0}if(previewInterval){clearInterval(previewInterval);previewInterval=0}$('preview').textContent='▶ 繼續試聽';updatePreviewProgress()}};
  audio.onended=()=>{if(previewAudio===audio){previewPosition=trimSettings().length;if(previewAnimation){cancelAnimationFrame(previewAnimation);previewAnimation=0}if(previewInterval){clearInterval(previewInterval);previewInterval=0}$('preview').textContent='↻ 重新試聽';updatePreviewProgress()}};
  audio.onerror=()=>{if(previewAudio===audio){stopPreview();notice('試聽失敗，請檢查媒體音量或音訊輸出')}};
  $('stop').disabled=false;
  const playback=audio.play(); // user gesture stays synchronous for iOS
  $('preview').textContent='Ⅱ 暫停試聽';
  if(playback&&playback.catch)playback.catch(e=>{if(previewAudio===audio){$('preview').textContent='▶ 繼續試聽';notice('iPhone 無法開始試聽：'+(e.message||e.name))}});
 }catch(e){stopPreview();notice('試聽準備失敗：'+(e.message||e.name))}
}
const waveDrag={active:false,handle:null};
function setSelection(start,end){
 const duration=state.buffer.duration;
 start=clamp(start,0,Math.max(0,duration-1));
 end=clamp(end,start+Math.min(1,duration),Math.min(duration,start+29));
 const length=clamp(end-start,Math.min(1,duration),29);
 $('start').value=start.toFixed(1);
 $('length').value=length.toFixed(1);
 $('start').max=Math.max(0,duration-length).toFixed(1);
 stopPreview();updateOverlay();
}
function wavePointerPosition(e){
 const r=$('waveWrap').getBoundingClientRect();
 return Math.round(clamp((e.clientX-r.left)/r.width*state.buffer.duration,0,state.buffer.duration)*10)/10;
}
function moveWaveHandle(e){
 if(!state.buffer||!waveDrag.active)return;
 const pos=wavePointerPosition(e),s=trimSettings();
 if(waveDrag.handle==='start')setSelection(clamp(pos,Math.max(0,s.end-29),s.end-Math.min(1,state.buffer.duration)),s.end);
 else setSelection(s.start,clamp(pos,s.start+Math.min(1,state.buffer.duration),Math.min(state.buffer.duration,s.start+29)));
}
$('waveWrap').addEventListener('pointerdown',e=>{
 if(!state.buffer)return;
 const pos=wavePointerPosition(e),s=trimSettings();
 waveDrag.handle=Math.abs(pos-s.start)<=Math.abs(pos-s.end)?'start':'end';
 waveDrag.active=true;
 $('waveWrap').setPointerCapture(e.pointerId);
 moveWaveHandle(e);
});
$('waveWrap').addEventListener('pointermove',moveWaveHandle);
function finishWaveDrag(){waveDrag.active=false;waveDrag.handle=null}
$('waveWrap').addEventListener('pointerup',finishWaveDrag);
$('waveWrap').addEventListener('pointercancel',finishWaveDrag);
async function getContext(){if(!state.ctx)state.ctx=new (window.AudioContext||window.webkitAudioContext)();if(state.ctx.state==='suspended')await withTimeout(state.ctx.resume(),8000,'iOS 未允許音樂播放，請再按一次試聽或製作');return state.ctx}
function gainEnvelope(ctx,settings,at){const node=ctx.createGain(),v=settings.volume,fade=Math.min(.3,settings.length/3);node.gain.setValueAtTime(settings.fade?0:v,at);if(settings.fade){node.gain.linearRampToValueAtTime(v,at+fade);node.gain.setValueAtTime(v,at+settings.length-fade);node.gain.linearRampToValueAtTime(0,at+settings.length)}return node}
// iOS Safari may leave AudioContext.resume() pending until another gesture.
// File selection and decoding must never wait for audio playback to be unlocked.
const withTimeout=(promise,ms,message)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(message)),ms);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)})});
function readAudioFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('無法開啟此檔案'));reader.onabort=()=>reject(new Error('檔案讀取已取消'));reader.readAsArrayBuffer(file)})}
let loadSequence=0;
async function loadFile(file){
 if(!file)return;
 if(!/\.(mp3|m4a|wav|aac|aiff|aif|flac|ogg|mp4)$/i.test(file.name)&&!file.type.startsWith('audio/')){notice('請選擇音樂檔案');return}
 const request=++loadSequence;
 stopPreview();state.buffer=null;state.file=null;
 $('fileMeta').hidden=false;$('fileMeta').textContent='正在開啟檔案…';$('editor').hidden=true;$('exportSection').hidden=true;
 try{
  if(!file.size)throw Error('檔案是空的，請重新下載或選擇其他音樂');
  if(file.size>120*1024*1024)throw Error('音樂超過 120 MB；iPhone 記憶體可能不足，請改用較小的 MP3 或 M4A');
  // Read before creating AudioContext; iCloud downloads may take time.
  const ab=await withTimeout(readAudioFile(file),60000,'讀取檔案逾時。若檔案在 iCloud，請先下載到 iPhone「檔案」後重試。');
  if(request!==loadSequence)return;
  $('fileMeta').textContent='已取得檔案，正在解析音訊…';
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)throw Error('此瀏覽器不支援音訊編輯，請用 Safari 開啟');
  // decodeAudioData works on suspended contexts on Safari; resume only when preview/export starts.
  const ctx=state.ctx||(state.ctx=new AudioContextClass());
  const buffer=await withTimeout(ctx.decodeAudioData(ab),35000,'音訊解析逾時。請改用無 DRM 的 MP3 或 M4A，或先縮短原音樂。');
  if(request!==loadSequence)return;
  if(!Number.isFinite(buffer.duration)||buffer.duration<1)throw Error('音訊長度至少須 1 秒');
  state.buffer=buffer;state.file=file;
  const maxLength=Math.min(29,Math.floor(buffer.duration*10)/10),length=Math.min(maxLength,29);
  $('start').max=Math.max(0,buffer.duration-length).toFixed(1);$('start').value='0';
  $('length').max=maxLength.toFixed(1);$('length').min=Math.min(1,maxLength).toFixed(1);$('length').value=length.toFixed(1);
  $('sourceEnd').textContent=sec(buffer.duration);$('filename').value=file.name.replace(/\.[^.]+$/,'').slice(0,60)||'我的專屬鈴聲';
  $('fileMeta').textContent=`已載入：${file.name} · ${sec(buffer.duration)} · ${(file.size/1048576).toFixed(1)} MB`;
  $('editor').hidden=false;$('exportSection').hidden=false;$('result').hidden=true;
  drawWave();setTimeout(()=>$('editor').scrollIntoView({behavior:'smooth',block:'start'}),100);
 }catch(e){
  if(request!==loadSequence)return;
  console.error('RingMaker loadFile failed:',e);
  const reason=e?.name==='EncodingError'||e?.name==='NotSupportedError'?'此音樂編碼不受 iPhone Safari 支援，或檔案有 DRM；請換成一般 MP3 / M4A / WAV':(e?.message||'未知錯誤');
  $('fileMeta').textContent='讀取失敗：'+reason;
  notice('讀取失敗：'+reason);
 }finally{if(request===loadSequence)$('file').value=''}
}
function clipPCM(){const s=trimSettings(),b=state.buffer,sampleRate=b.sampleRate,total=Math.max(1,Math.floor(s.length*sampleRate)),offset=Math.floor(s.start*sampleRate),channels=[];for(let ch=0;ch<Math.min(b.numberOfChannels,2);ch++){const source=b.getChannelData(ch),out=new Float32Array(total);for(let i=0;i<total;i++){let v=source[Math.min(source.length-1,offset+i)]||0;if(s.fade){const fade=Math.min(.3,s.length/3),t=i/sampleRate;v*=Math.min(1,t/fade,(s.length-t)/fade)}out[i]=clamp(v*s.volume,-1,1)}channels.push(out)}return {channels,sampleRate,total}}
function writeWav(pcm){const {channels,sampleRate,total}=pcm,nch=channels.length,size=44+total*nch*2,out=new ArrayBuffer(size),v=new DataView(out);function textAt(offset,str){for(let i=0;i<str.length;i++)v.setUint8(offset+i,str.charCodeAt(i))}textAt(0,'RIFF');v.setUint32(4,size-8,true);textAt(8,'WAVE');textAt(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nch,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*nch*2,true);v.setUint16(32,nch*2,true);v.setUint16(34,16,true);textAt(36,'data');v.setUint32(40,total*nch*2,true);let o=44;for(let i=0;i<total;i++)for(let ch=0;ch<nch;ch++){const val=clamp(channels[ch][i],-1,1);v.setInt16(o,val<0?val*32768:val*32767,true);o+=2}return new Blob([out],{type:'audio/wav'})}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function cleanName(){return ($('filename').value||'我的專屬鈴聲').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,60)||'ringtone'}
async function exportWav(){if(!state.buffer)return;try{const wav=writeWav(clipPCM());downloadBlob(wav,cleanName()+'.wav');notice('WAV 備份已匯出；如需直接設鈴聲，請使用 M4A。')}catch(e){notice('WAV 製作失敗：'+e.message)}}
async function exportM4A(){if(!state.buffer||state.busy)return;if(typeof MediaRecorder==='undefined'||typeof MediaRecorder.isTypeSupported!=='function'||!['audio/mp4;codecs=mp4a.40.2','audio/mp4'].some(m=>MediaRecorder.isTypeSupported(m))){notice('此瀏覽器不支援 M4A 編碼。請在 iPhone Safari 開啟，或先使用 WAV 備份。');return}state.busy=true;$('render').disabled=true;$('render').textContent='正在製作…請保持畫面開啟';stopPreview();let rec,ctx,source,stream,g;try{ctx=await getContext();const mime=['audio/mp4;codecs=mp4a.40.2','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m)),s=trimSettings(),pcm=clipPCM(),buffer=ctx.createBuffer(pcm.channels.length,pcm.total,pcm.sampleRate);for(let ch=0;ch<pcm.channels.length;ch++)buffer.copyToChannel(pcm.channels[ch],ch);stream=ctx.createMediaStreamDestination();source=ctx.createBufferSource();source.buffer=buffer;g=ctx.createGain();g.gain.value=1;source.connect(g);g.connect(stream);/* Connect silent monitor to destination so iOS continues rendering. */const monitor=ctx.createGain();monitor.gain.value=0;g.connect(monitor).connect(ctx.destination);let chunks=[];rec=new MediaRecorder(stream.stream,{mimeType:mime,audioBitsPerSecond:160000});const output=new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onerror=e=>reject(e.error||Error('錄製失敗'));rec.onstop=()=>{const blob=new Blob(chunks,{type:'audio/mp4'});blob.size>1000?resolve(blob):reject(Error('沒有產生可用的 M4A 音訊'))}});rec.start();source.start(ctx.currentTime+.1);await new Promise((resolve,reject)=>{source.onended=resolve;setTimeout(()=>reject(Error('錄製逾時')),Math.ceil((s.length+5)*1000))});await new Promise(r=>setTimeout(r,220));if(rec.state!=='inactive')rec.stop();const blob=await output;const file=new File([blob],cleanName()+'.m4a',{type:'audio/mp4'});if(state.objectURL)URL.revokeObjectURL(state.objectURL);state.objectURL=URL.createObjectURL(blob);$('resultAudio').src=state.objectURL;$('download').href=state.objectURL;$('download').download=file.name;$('share').onclick=async()=>{try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:file.name})}else{downloadBlob(blob,file.name);notice('已開始下載，請到「檔案」App 找到 M4A。')}}catch(e){if(e.name!=='AbortError')notice('無法開啟分享：'+e.message)}};$('result').hidden=false;$('result').scrollIntoView({behavior:'smooth',block:'center'});notice('M4A 已完成！請按「儲存到 iPhone」，選擇「儲存到檔案」。')}catch(e){notice('M4A 製作失敗：'+e.message)}finally{try{if(rec?.state==='recording')rec.stop()}catch{}try{source?.disconnect();g?.disconnect()}catch{}state.busy=false;$('render').disabled=false;$('render').textContent='♫ 製作 M4A 鈴聲'}}
function youtubeId(input){let u;try{u=new URL(input.trim())}catch{return null}const h=u.hostname.toLowerCase();let id;if(h==='youtu.be'||h==='www.youtu.be')id=u.pathname.split('/')[1];else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)){id=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1]}return /^[\w-]{11}$/.test(id||'')?id:null}
$('file').addEventListener('change',e=>loadFile(e.target.files?.[0]));
$('start').addEventListener('input',()=>{
 if(!state.buffer)return;
 const length=Number($('length').value);
 $('start').value=Math.min(Number($('start').value),Math.max(0,state.buffer.duration-length)).toFixed(1);
 stopPreview();updateOverlay();
});
$('length').addEventListener('input',()=>{
 if(!state.buffer)return;
 const length=Number($('length').value);
 $('start').max=Math.max(0,state.buffer.duration-length).toFixed(1);
 $('start').value=Math.min(Number($('start').value),Number($('start').max)).toFixed(1);
 stopPreview();updateOverlay();
});
$('previewSeek').addEventListener('input',e=>seekPreview(Number(e.target.value)));
$('skipBack').addEventListener('click',()=>skipPreview(-5));
$('skipForward').addEventListener('click',()=>skipPreview(5));
$('volume').addEventListener('input',()=>{stopPreview();$('volumeValue').textContent=$('volume').value+'%'});$('preview').addEventListener('click',preview);$('fade').addEventListener('change',stopPreview);$('stop').addEventListener('click',stopPreview);$('render').addEventListener('click',exportM4A);$('wav').addEventListener('click',exportWav);$('youtubeGo').addEventListener('click',()=>{const id=youtubeId($('youtubeUrl').value);$('youtubeError').hidden=!!id;if(!id){$('youtubeError').textContent='請貼上有效的 YouTube 影片網址。';$('youtubePlayer').hidden=true;return}const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id);iframe.title='YouTube 影片預覽';iframe.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;$('youtubePlayer').replaceChildren(iframe);$('youtubePlayer').hidden=false});let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>state.buffer&&drawWave(),150)});window.addEventListener('pagehide',stopPreview);if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
