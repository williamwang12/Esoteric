import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/config';

interface EsotericStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class EsotericStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EsotericStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ==============================================
    // VPC - Virtual Private Cloud
    // ==============================================
    const vpc = new ec2.Vpc(this, 'EsotericVpc', {
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // ==============================================
    // Secrets Manager - Secure environment variables
    // ==============================================
    
    // Database credentials
    const dbCredentials = new rds.DatabaseSecret(this, 'DatabaseSecret', {
      username: 'postgres',
    });

    // Application secrets
    const appSecrets = new secretsmanager.Secret(this, 'AppSecrets', {
      description: 'Application environment variables',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          NODE_ENV: config.environment,
          PORT: '5002',
          JWT_EXPIRES_IN: '7d',
          // Calendly credentials
          CALENDLY_API_TOKEN: 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzU4Mjk5Njg2LCJqdGkiOiIxOTU1YzZkYy01ZGQyLTRkYWItOTA2NS05NmE3MTBlZjY1Y2IiLCJ1c2VyX3V1aWQiOiIxN2E3NWExYi1kYmJmLTQyNTYtYWUzNS03YThjZGJiNDgyZmIifQ.BOVwQVy3w7P2CVMPrD_x84f5sQ0GPubJftbNosHpNfalWwZy4f0_A8HczYbyqTvAgY3PJh-Wef3_cYFgfZBLLA',
          CALENDLY_USER_URI: 'https://api.calendly.com/users/17a75a1b-dbbf-4256-ae35-7a8cdbb482fb',
          CALENDLY_API_BASE_URL: 'https://api.calendly.com',
          // DocuSign credentials
          DOCUSIGN_INTEGRATION_KEY: '36199215-2892-4e91-94e7-bc7aa3ce0e50',
          DOCUSIGN_CLIENT_SECRET: '39110a4d-81f4-4867-ace5-572ef64d0dea',
          DOCUSIGN_USER_ID: '33a9927e-c89f-4f1c-a5f0-7e3bdbe6043e',
          DOCUSIGN_ACCOUNT_ID: '43132555',
          DOCUSIGN_PRIVATE_KEY_PATH: './keys/docusign_private_key.pem',
          DOCUSIGN_ENVIRONMENT: 'demo',
          DOCUSIGN_REDIRECT_URI: 'https://developers.docusign.com/platform/auth/consent',
        }),
        generateStringKey: 'JWT_SECRET',
        excludeCharacters: '"@/\\\'',
      },
    });

    // ==============================================
    // RDS PostgreSQL Database
    // ==============================================
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for PostgreSQL database',
      allowAllOutbound: false,
    });

    const database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of('15.14', '15'),
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        config.database.instanceClass.split('.')[2] as ec2.InstanceSize
      ),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      databaseName: 'esoteric_loans',
      multiAz: config.database.multiAz,
      deletionProtection: config.database.deletionProtection,
      backupRetention: cdk.Duration.days(config.database.backupRetention),
      preferredBackupWindow: config.database.preferredBackupWindow,
      preferredMaintenanceWindow: config.database.preferredMaintenanceWindow,
      deleteAutomatedBackups: !config.database.deletionProtection,
      removalPolicy: config.database.deletionProtection ? 
        cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ==============================================
    // S3 Bucket for file storage and frontend hosting
    // ==============================================
    const bucket = new s3.Bucket(this, 'EsotericBucket', {
      bucketName: `${config.appName}-bucket-${cdk.Aws.ACCOUNT_ID}`,
      versioned: config.storage.enableVersioning,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront distribution for frontend
    let distribution: cloudfront.Distribution | undefined;
    if (config.storage.enableCloudFront) {
      distribution = new cloudfront.Distribution(this, 'EsotericDistribution', {
        defaultBehavior: {
          origin: new origins.S3Origin(bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
      });
    }

    // ==============================================
    // ECR Repositories for container images
    // ==============================================
    const backendRepository = new ecr.Repository(this, 'BackendRepository', {
      // repositoryName: `${config.appName}-backend`, // Let CDK generate the name
      imageScanOnPush: true,
      lifecycleRules: [{
        maxImageCount: 10,
      }],
    });

    // ==============================================
    // ECS Cluster and Services
    // ==============================================
    const cluster = new ecs.Cluster(this, 'EsotericCluster', {
      vpc,
      clusterName: `${config.appName}-cluster`,
      containerInsights: true,
    });

    // Security group for ECS tasks
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
    });

    // Allow ECS to access database
    dbSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow ECS access to PostgreSQL'
    );

    // Task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'BackendTaskDefinition', {
      memoryLimitMiB: config.container.memory,
      cpu: config.container.cpu,
    });

    // CloudWatch log group
    const logGroup = new logs.LogGroup(this, 'BackendLogGroup', {
      logGroupName: `/aws/ecs/${config.appName}-backend`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container definition  
    const container = taskDefinition.addContainer('backend', {
      image: ecs.ContainerImage.fromRegistry('484069698162.dkr.ecr.us-east-1.amazonaws.com/esoteric-backend:latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logGroup,
      }),
      environment: {
        DB_HOST: database.instanceEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'esoteric_loans',
        DB_USER: 'postgres',
      },
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'JWT_SECRET'),
        NODE_ENV: ecs.Secret.fromSecretsManager(appSecrets, 'NODE_ENV'),
        PORT: ecs.Secret.fromSecretsManager(appSecrets, 'PORT'),
        JWT_EXPIRES_IN: ecs.Secret.fromSecretsManager(appSecrets, 'JWT_EXPIRES_IN'),
        CALENDLY_API_TOKEN: ecs.Secret.fromSecretsManager(appSecrets, 'CALENDLY_API_TOKEN'),
        CALENDLY_USER_URI: ecs.Secret.fromSecretsManager(appSecrets, 'CALENDLY_USER_URI'),
        CALENDLY_API_BASE_URL: ecs.Secret.fromSecretsManager(appSecrets, 'CALENDLY_API_BASE_URL'),
        DOCUSIGN_INTEGRATION_KEY: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_INTEGRATION_KEY'),
        DOCUSIGN_CLIENT_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_CLIENT_SECRET'),
        DOCUSIGN_USER_ID: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_USER_ID'),
        DOCUSIGN_ACCOUNT_ID: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_ACCOUNT_ID'),
        DOCUSIGN_PRIVATE_KEY_PATH: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_PRIVATE_KEY_PATH'),
        DOCUSIGN_ENVIRONMENT: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_ENVIRONMENT'),
        DOCUSIGN_REDIRECT_URI: ecs.Secret.fromSecretsManager(appSecrets, 'DOCUSIGN_REDIRECT_URI'),
      },
    });

    container.addPortMappings({
      containerPort: 5002,
      protocol: ecs.Protocol.TCP,
    });

    // Grant permissions to access S3 bucket
    bucket.grantReadWrite(taskDefinition.taskRole);

    // Grant permissions to read secrets
    appSecrets.grantRead(taskDefinition.taskRole);
    dbCredentials.grantRead(taskDefinition.taskRole);

    // Application Load Balancer with Fargate Service
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster,
      taskDefinition,
      serviceName: `${config.appName}-backend-service`,
      desiredCount: config.container.desiredCount,
      assignPublicIp: false,
      publicLoadBalancer: true,
      listenerPort: 80, // Start with HTTP for now
      domainName: config.domainName,
      domainZone: config.domainName ? undefined : undefined, // You would need to import your hosted zone here
    });

    // Configure health check
    /*
    fargateService.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Auto Scaling
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: config.container.minCapacity,
      maxCapacity: config.container.maxCapacity,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(5),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(5),
    });
    */

    // ==============================================
    // CloudWatch Alarms
    // ==============================================
    /*
    new cdk.aws_cloudwatch.Alarm(this, 'HighCpuAlarm', {
      metric: fargateService.service.metricCpuUtilization(),
      threshold: 90,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cdk.aws_cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: fargateService.service.metricMemoryUtilization(),
      threshold: 90,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    */

    // ==============================================
    // Outputs
    // ==============================================
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
    });

    /*
    new cdk.CfnOutput(this, 'LoadBalancerUrl', {
      value: `https://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'Application Load Balancer URL',
    });
    */

    new cdk.CfnOutput(this, 'BackendRepositoryUri', {
      value: backendRepository.repositoryUri,
      description: 'ECR Backend Repository URI',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket for file storage',
    });

    if (distribution) {
      new cdk.CfnOutput(this, 'CloudFrontUrl', {
        value: `https://${distribution.distributionDomainName}`,
        description: 'CloudFront distribution URL for frontend',
      });
    }

    new cdk.CfnOutput(this, 'SecretsManagerArn', {
      value: appSecrets.secretArn,
      description: 'Secrets Manager ARN for application secrets',
    });
  }
}