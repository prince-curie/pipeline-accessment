import Application from '@ioc:Adonis/Core/Application'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { ResponseContract } from '@ioc:Adonis/Core/Response';

interface IUserLimitData {
  lastRequestTime:number,
  numberOfRequest:number    
}

interface IFileData {
  [ip: string]: IUserLimitData
}

export default class RateLimiter {
  private file:string = Application.makePath('RateLimiterData.txt');
  
  private limit:number = 3;
  private timeDuration:number = 1000;
  
  public async handle({ response, request }: HttpContextContract, next: () => Promise<void>) {
    // code for middleware goes here. ABOVE THE NEXT CALL
    try {
      const currentTime:number = Math.floor(Date.now() / this.timeDuration);
      const userIp:string = request.ip();
      
      let fileData:IFileData = await this.read(response);
      
      if(fileData[userIp]) {
        this.rateLimit(fileData[userIp], currentTime);
        
        if(currentTime > fileData[userIp].lastRequestTime) {
          fileData = this.reset(fileData, userIp, currentTime);
        }
        
      } else {
        fileData[userIp] = {lastRequestTime: 0, numberOfRequest: 0};
      }
      
      await this.write(fileData, currentTime, userIp);

      this.setSuccessResponseHeaders(response, fileData[userIp]);
      
    } catch (error) {
      return this.errorResponse(error.message, response);
    }

    await next();
  }

  private read = async( response:ResponseContract ):Promise<IFileData> => {
    response.abortIf(!existsSync(this.file), 'System error', 500); 

    const fileDataAsString:string = await readFile(this.file, 'utf-8')

    return JSON.parse(fileDataAsString);
  }

  private rateLimit = ( userLimitData:IUserLimitData, currentTime:number ):void => {
    if(
      currentTime === userLimitData.lastRequestTime && 
      userLimitData.numberOfRequest >= this.limit
    ) {
      throw new Error("Too Many Request");
    }

    return;
  }

  private reset = (fileData:IFileData, userIp:string, currentTime:number):IFileData => {
    fileData[userIp].lastRequestTime = currentTime;
    fileData[userIp].numberOfRequest = 0;

    return fileData;
  }

  private write = async(fileData:IFileData, currentTime:number, userIp:string):Promise<void> => {
    fileData[userIp].lastRequestTime = currentTime;
    fileData[userIp].numberOfRequest += 1;

    await writeFile(this.file, JSON.stringify(fileData))

    return;
  }

  private setSuccessResponseHeaders = (response:ResponseContract, userLimitData:IUserLimitData):void => {
    response.header('X-Ratelimit-Limit', this.limit)
      .header('X-Ratelimit-Remaining', this.limit - userLimitData.numberOfRequest);

    return;
  }

  private errorResponse = (message:string, response:ResponseContract) => {
    if(message === 'Too Many Request') {
      return response.header('Retry-After', 1)
        .header('X-Ratelimit-Limit', this.limit)
        .status(429).json({
          "errors": [
              {
                "message": "Too many requests",
                "retryAfter": `${this.timeDuration / 1000} sec`
              }
          ]
        });
    }

    return response.status(500).json({
        "errors": {
          "message": "System Error",
        }
      });
  }
}
