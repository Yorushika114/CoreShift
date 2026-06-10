// 封装麦克风采集生命周期：getUserMedia → AudioContext(16kHz) → AudioWorklet → PCM 回调。
// 调用方只需关心 start(onChunk) 和 stop()，无需直接操作 Web Audio API。

export class MicCapture {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;

  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true },
    });

    // 强制 16kHz：讯飞 IAT 要求 audio/L16;rate=16000
    this.ctx = new AudioContext({ sampleRate: 16000 });
    await this.ctx.audioWorklet.addModule('/pcm-capture-processor.js');

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.ctx, 'pcm-capture-processor');
    this.workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      onChunk(e.data);
    };

    // 连接但不接入 destination（静默采集，不播放回声）
    this.source.connect(this.workletNode);
  }

  stop(): void {
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.source = null;
    this.workletNode = null;
    this.stream = null;
  }
}
