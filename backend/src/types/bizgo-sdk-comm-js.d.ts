declare module '@bizgo/bizgo-sdk-comm-js' {
  export class Bizgo {
    constructor(options?: any);
    send?: {
      OMNI(request: any): Promise<any>;
    };
  }

  export class BizgoOptionsBuilder {
    [key: string]: any;
    setBaseURL(value: string): this;
    setApiKey(value: string): this;
    build(): any;
  }

  export class AlimtalkBuilder {
    [key: string]: any;
    setSenderKey(value: string): this;
    setMsgType(value: string): this;
    setTemplateCode(value: string): this;
    setMessage(value: string): this;
    setText(value: string): this;
    setAttachment(value: any): this;
    build(): any;
  }

  export class AlimtalkAttachmentBuilder {
    [key: string]: any;
    setButton(value: any): this;
    build(): any;
  }

  export class BrandMessageBuilder {
    [key: string]: any;
    setSenderKey(value: string): this;
    setSendType(value: string): this;
    setMsgType(value: string): this;
    setMessage(value: string): this;
    setText(value: string): this;
    setAttachment(value: any): this;
    build(): any;
  }

  export class BrandMessageAttachmentBuilder {
    [key: string]: any;
    setButton(value: any): this;
    build(): any;
  }

  export class DestinationBuilder {
    [key: string]: any;
    setTo(value: string): this;
    build(): any;
  }

  export class OMNIRequestBodyBuilder {
    [key: string]: any;
    setDestinations(value: any[]): this;
    setMessageFlow(value: any[]): this;
    build(): any;
  }

  export class KakaoButtonBuilder {
    [key: string]: any;
    setType(value: string): this;
    setName(value: string): this;
    setUrlMobile(value: string): this;
    setUrlPc(value: string): this;
    build(): any;
  }
}
