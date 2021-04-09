# FIREDAO Protocol

![logo](https://github.com/FIREDAO/firedao-protocol/raw/main/logo_180.png)

FIREDAO is an easy-to-use tool that maximizes returns for cryptocurrency assets by automatically deploying them to decentralized finance (DeFi) protocols that generate the highest yield via lending, farming and exchange services.

## Configuration

Set `MNEMONIC` to `.env` file (see `.env.example`).

```bash
yarn install
```

## Testing

```bash
yarn test
```

## Deployment to local BSC fork

```bash
npx hardhat node
```

## Deployment

```bash
yarn deploy --network bsc
```
