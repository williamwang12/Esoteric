export interface EnvironmentConfig {
  // Environment settings
  environment: string;
  region: string;
  account?: string;
  
  // Application settings
  appName: string;
  domainName?: string;
  
  // Database settings
  database: {
    instanceClass: string;
    multiAz: boolean;
    deletionProtection: boolean;
    backupRetention: number;
    preferredBackupWindow: string;
    preferredMaintenanceWindow: string;
  };
  
  // Container settings
  container: {
    cpu: number;
    memory: number;
    desiredCount: number;
    minCapacity: number;
    maxCapacity: number;
  };
  
  // Storage settings
  storage: {
    enableCloudFront: boolean;
    enableVersioning: boolean;
  };
  
  // Security settings
  security: {
    enableWaf: boolean;
    allowedCidrs: string[];
  };
}

export const environments: { [key: string]: EnvironmentConfig } = {
  staging: {
    environment: 'staging',
    region: 'us-east-1',
    appName: 'esoteric-staging',
    
    database: {
      instanceClass: 'db.t3.micro',
      multiAz: false,
      deletionProtection: false,
      backupRetention: 7,
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
    },
    
    container: {
      cpu: 512,
      memory: 1024,
      desiredCount: 1,
      minCapacity: 1,
      maxCapacity: 3,
    },
    
    storage: {
      enableCloudFront: true,
      enableVersioning: false,
    },
    
    security: {
      enableWaf: false,
      allowedCidrs: ['0.0.0.0/0'], // Open for staging
    },
  },
  
  production: {
    environment: 'production',
    region: 'us-east-1',
    appName: 'esoteric-production',
    domainName: 'app.esoteric.com', // Update with your actual domain
    
    database: {
      instanceClass: 'db.t3.medium',
      multiAz: true,
      deletionProtection: true,
      backupRetention: 30,
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
    },
    
    container: {
      cpu: 1024,
      memory: 2048,
      desiredCount: 2,
      minCapacity: 2,
      maxCapacity: 10,
    },
    
    storage: {
      enableCloudFront: true,
      enableVersioning: true,
    },
    
    security: {
      enableWaf: true,
      allowedCidrs: ['0.0.0.0/0'], // Consider restricting in production
    },
  },
};

export function getConfig(environment: string): EnvironmentConfig {
  const config = environments[environment];
  if (!config) {
    throw new Error(`Configuration not found for environment: ${environment}`);
  }
  return config;
}