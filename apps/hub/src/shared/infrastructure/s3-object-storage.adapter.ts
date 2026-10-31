import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';

import type { ObjectStorageConfigInterface } from '../application/app-config.interface.js';
import type {
  ObjectStoragePort,
  StoredObjectInterface,
} from '../application/object-storage.port.js';

/** An S3 service (MinIO, Amazon, Yandex and the like) with the files in one bucket. */
export class S3ObjectStorageAdapter implements ObjectStoragePort, OnApplicationBootstrap {
  readonly enabled = true;
  private bucketReady = false;
  private readonly client: S3Client;
  /** Signs for the address a browser uses: the signature covers the host. Nothing is sent through it. */
  private readonly signer: S3Client;

  constructor(
    private readonly config: ObjectStorageConfigInterface,
    private readonly logger: LoggerPort,
  ) {
    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
    // The path of the bucket is in the address, not in the name of the host: a service on a private host has no wildcard name.
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials,
      forcePathStyle: true,
    });
    this.signer = new S3Client({
      endpoint: config.publicUrl,
      region: config.region,
      credentials,
      forcePathStyle: true,
    });
  }

  /** The bucket is made when it is missing; a service that is down is no reason to stop the hub, and the first file asks again. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (error: unknown) {
      this.logger.warn(`The bucket ${this.config.bucket} is not ready: ${errorMessage(error)}`);
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
      this.logger.info(`Created the bucket ${this.config.bucket}`);
    }
    this.bucketReady = true;
  }

  async put(key: string, object: StoredObjectInterface): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: object.body,
        ContentType: object.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  signedUrl(key: string, expiresInSeconds: number, now: Date): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      { expiresIn: expiresInSeconds, signingDate: now },
    );
  }
}
