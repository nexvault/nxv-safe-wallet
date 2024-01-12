import { task } from "hardhat/config";
task('deploy-factory', 'Deploy a NXVProxyFactory')
  .setAction(async (_, hre) => {
  const NXVProxyFactory = await hre.ethers.getContractFactory('NXVProxyFactory');
  console.log('Deploying NXVProxyFactory...');

  const walletFactory = await NXVProxyFactory.deploy();

  await walletFactory.waitForDeployment();
  console.log('NXVProxyFactory deployed to:', walletFactory.target);

  const receipt = await walletFactory.deploymentTransaction()?.wait();
  console.log('Deployment Hash: ', receipt?.hash);
  console.log('Transaction gasUsed:', receipt?.gasUsed?.toString());
});

task('deploy-NXVImplementation', 'Deploy a NXVImplementation')
  .setAction(async (_, hre) => {
  const NXV = await hre.ethers.getContractFactory("NXV");

  console.log('Deploying NXVImplementation...');

  const walletImpl = await NXV.deploy();
  await walletImpl.waitForDeployment();

  const receipt = await walletImpl.deploymentTransaction()?.wait();

  console.log('NXVImplementation deployed to', walletImpl.target);
  console.log('Deployment Hash:', receipt?.hash);

  console.log('Transaction gasUsed:', receipt?.gasUsed.toString());
});

task('deploy-fallbackHandler', 'Deploy a FallbackHandler')
  .setAction(async (_, hre) => {
  const FallbackHandler = await hre.ethers.getContractFactory("CompatibilityFallbackHandler");

  console.log('Deploying CompatibilityFallbackHandler...');

  const fallback = await FallbackHandler.deploy();
  await fallback.waitForDeployment();

  const receipt = await fallback.deploymentTransaction()?.wait();

  console.log('CompatibilityFallbackHandler deployed to', fallback.target);
  console.log('Deployment Hash:', receipt?.hash);
  console.log('Transaction gasUsed:', receipt?.gasUsed.toString());
});

task('deploy-multiSendCallOnly', 'Deploy MultiSendCallOnly')
  .setAction(async (_, hre) => {
  const MultiSendCallOnly = await hre.ethers.getContractFactory("MultiSendCallOnly");

  console.log('Deploying MultiSendCallOnly...');

  const multicall = await MultiSendCallOnly.deploy();
  await multicall.waitForDeployment();

  const receipt = await multicall.deploymentTransaction()?.wait();

  console.log('MultiSendCallOnly deployed to', multicall.target);
  console.log('Deployment Hash:', receipt?.hash);
  console.log('Transaction gasUsed:', receipt?.gasUsed?.toString());
});

task('deploy-multiSend', 'Deploy MultiSend')
  .setAction(async (_, hre) => {
  const MultiSend = await hre.ethers.getContractFactory("MultiSend");

  console.log('Deploying MultiSend...');

  const multicall = await MultiSend.deploy();
  await multicall.waitForDeployment();

  const receipt = await multicall.deploymentTransaction()?.wait();

  console.log('MultiSendCallOnly deployed to', multicall.target);
  console.log('Deployment Hash:', receipt?.hash);
  console.log('Transaction gasUsed:', receipt?.gasUsed?.toString());
});

task('deploy-migration', 'Deploy NXVStorage and NXVMigration')
  .setAction(async (_, hre) => {
  const NXVMigration = await hre.ethers.getContractFactory("NXVMigration");

  console.log('Deploying NXVMigration...');

  const migrate = await NXVMigration.deploy();
  await migrate.waitForDeployment();

  const receipt = await migrate.deploymentTransaction()?.wait();

  console.log('NXVMigration deployed to', migrate.target);
  console.log('Deployment Hash:', receipt?.hash);
  console.log('Transaction gasUsed:', receipt?.gasUsed?.toString());
});

task('deploy-signMessageLib', 'Deploy signMessageLib')
  .setAction(async (_, hre) => {
  const SignMessageLib = await hre.ethers.getContractFactory("SignMessageLib");

  console.log('Deploying SignMessageLib...');

  const signMessageLib = await SignMessageLib.deploy();
  await signMessageLib.waitForDeployment();

  const receipt = await signMessageLib.deploymentTransaction()?.wait();

  console.log('signMessageLib deployed to', signMessageLib.target);
  console.log('Deployment Hash:', receipt?.hash);
  console.log('Transaction gasUsed:', receipt?.gasUsed?.toString());
});

task('calculate-wallet-address', 'Calculate a NXVProxy address with params')
  .addParam('factory', 'The NXVProxyFactory contract to call')
  .addParam('implementation', 'The NXVProxy implementation contract to use')
  .addParam('fallbackhandler', 'The CompatibilityFallbackHandler contract to use')
  .addParam('owners', 'owners of NXV')
  .addParam('required', 'required of NXV')
  .addParam('nonce', 'nonce of "create2" opcode to calculate NXV address')
  .setAction(async (args, hre) => {
    const NXVProxyFactory = await hre.ethers.getContractFactory('NXVProxyFactory');
    const NXVImplementation = await hre.ethers.getContractFactory('NXV');
    const FallbackHandler = await hre.ethers.getContractFactory("CompatibilityFallbackHandler")

    const walletFactory: any = NXVProxyFactory.attach(args.factory);
    const walletImplementation = NXVImplementation.attach(args.implementation);
    const fallbackHandler = FallbackHandler.attach(args.fallbackhandler);

    console.log('NXVProxyFactory is:', await walletFactory.getAddress());
    console.log('NXVImplementation is:', await walletImplementation.getAddress());
    console.log('FallbackHandler is:', await fallbackHandler.getAddress());

    const owners = args.owners.split(',');
    const required = args.required;
    const nonce = args.nonce;
    console.log(`${owners}, ${required}, ${nonce}`);

    console.log('Calculating NXVProxy Address...');

    const initializer = walletImplementation.interface.encodeFunctionData("setup", [
      owners, required,
      await fallbackHandler.getAddress(), // CompatibilityFallbackHandler
    ])

    const walletProxyAddress = await walletFactory.calculateNXVAddress(
      walletImplementation.getAddress(),
      initializer,
      nonce
    );
    console.log('NXVProxy address is:', walletProxyAddress);
  });


task('create-wallet', 'Create a NXVProxy with params')
  .addParam('factory', 'The NXVProxyFactory contract to call')
  .addParam('implementation', 'The NXVProxy implementation contract to use')
  .addParam('fallbackhandler', 'The CompatibilityFallbackHandler contract to use')
  .addParam('owners', 'owners of NXV')
  .addParam('required', 'required of NXV')
  .addParam('nonce', 'nonce of "create2" opcode to calculate NXV address')
  .setAction(async (args, hre) => {
    const NXVProxyFactory = await hre.ethers.getContractFactory('NXVProxyFactory');
    const NXVImplementation = await hre.ethers.getContractFactory('NXV');
    const FallbackHandler = await hre.ethers.getContractFactory("CompatibilityFallbackHandler")

    const walletFactory: any = NXVProxyFactory.attach(args.factory);
    const walletImplementation = NXVImplementation.attach(args.implementation);
    const fallbackHandler = FallbackHandler.attach(args.fallbackhandler);

    console.log('NXVProxyFactory is:', await walletFactory.getAddress());
    console.log('NXVImplementation is:', await walletImplementation.getAddress());
    console.log('FallbackHandler is:', await fallbackHandler.getAddress());

    const owners = args.owners.split(',');
    const required = args.required;
    const nonce = args.nonce;
    console.log(`${owners}, ${required}, ${nonce}`);

    console.log('Creating NXVProxy...');

    const initializer = walletImplementation.interface.encodeFunctionData("setup", [
      owners, required,
      await fallbackHandler.getAddress(), // CompatibilityFallbackHandler
    ])
    const transaction = await walletFactory.createProxyWithNonce(
      await walletImplementation.getAddress(),
      initializer,
      nonce
    );
    const receipt = await transaction.wait();
    console.log('NXV proxy deployed at:', receipt?.logs[0].address, "\n");
    console.log('Deployment Hash:', receipt.hash);

    const gasUsed = receipt.gasUsed;
    console.log('Transaction gasUsed:', gasUsed.toString());
  });

