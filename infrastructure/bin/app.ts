#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EsotericStack } from '../lib/esoteric-stack';
import { getConfig } from '../config/config';

const app = new cdk.App();

// Get environment from context or use staging as default
const environment = app.node.tryGetContext('environment') || 'staging';
const config = getConfig(environment);

// Create stack with environment-specific configuration
new EsotericStack(app, `EsotericStack-${environment}`, {
  config,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
  description: `Esoteric Loan Management Platform - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'Esoteric',
    ManagedBy: 'CDK',
  },
});