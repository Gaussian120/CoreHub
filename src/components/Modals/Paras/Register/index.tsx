import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
  useTheme,
} from '@mui/material';
import { compactAddLength } from '@polkadot/util';
import { useEffect, useState } from 'react';

import { getBalanceString } from '@/utils/functions';

import { FileInput, ProgressButton } from '@/components/Elements';

import { useAccounts } from '@/contexts/account';
import { useRelayApi } from '@/contexts/apis';
import { ApiState } from '@/contexts/apis/types';
import { useToast } from '@/contexts/toast';

import styles from './index.module.scss';

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;

  paraId: number;
  dataDepositPerByte: bigint;
  maxCodeSize: bigint;
}

export const RegisterModal = ({
  open,
  onClose,
  paraId,
  dataDepositPerByte,
  maxCodeSize,
}: RegisterModalProps) => {
  const theme = useTheme();

  const {
    state: { api, apiState, decimals, symbol },
  } = useRelayApi();
  const {
    state: { activeAccount, activeSigner },
  } = useAccounts();
  const { toastError, toastInfo, toastSuccess } = useToast();

  const [working, setWorking] = useState(false);
  const [genesisHead, setGenesisHead] = useState<Uint8Array>();
  const [wasmCode, setWasmCode] = useState<Uint8Array>();

  const regCost =
    dataDepositPerByte * (BigInt(genesisHead?.length ?? 0) + maxCodeSize);

  const onRegister = async () => {
    if (!genesisHead) {
      toastError('Please upload genesis head');
      return;
    }
    if (!wasmCode) {
      toastError('Please upload validation code');
      return;
    }
    if (!api || apiState !== ApiState.READY) {
      toastError('Please check the connection to the relay chain');
      return;
    }
    if (!activeAccount || !activeSigner) {
      toastError('Please connect your wallet');
      return;
    }
    const tx = api.tx.registrar.register(
      paraId,
      compactAddLength(genesisHead),
      compactAddLength(wasmCode)
    );
    try {
      setWorking(true);
      await tx.signAndSend(
        activeAccount.address,
        { signer: activeSigner },
        ({ status, events }) => {
          if (status.isReady) toastInfo('Transaction was initiated');
          else if (status.isInBlock) toastInfo(`In Block`);
          else if (status.isFinalized) {
            setWorking(false);
            events.forEach(({ event: { method } }) => {
              if (method === 'ExtrinsicSuccess') {
                toastSuccess('Registration success');
                onClose();
              } else if (method === 'ExtrinsicFailed') {
                toastError(`Failed to register`);
              }
            });
          }
        }
      );
    } catch (e) {
      toastError(`Failed to register.Error: ${e}`);
      setWorking(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setWorking(false);
    setWasmCode(undefined);
    setGenesisHead(undefined);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth='md'>
      <DialogContent className={styles.container}>
        <Box>
          <Typography
            variant='subtitle1'
            sx={{ color: theme.palette.common.black }}
          >
            Register Parachain
          </Typography>
          <Typography
            variant='subtitle2'
            sx={{ color: theme.palette.text.primary }}
          >
            Fill out the detail to register parachain
          </Typography>
        </Box>
        <Box className={styles.info}>
          <Box className={styles.infoItem}>
            <Typography className={styles.itemKey}>PARA ID:</Typography>
            <Typography
              sx={{ color: theme.palette.common.black }}
              className={styles.itemValue}
            >
              {paraId}
            </Typography>
          </Box>
          <Box className={styles.infoItem}>
            <Typography className={styles.itemKey}>
              Registration Cost:
            </Typography>
            <Typography
              sx={{ color: theme.palette.common.black }}
              className={styles.itemValue}
            >
              {getBalanceString(regCost.toString(), decimals, symbol)}
            </Typography>
          </Box>
        </Box>
        <Box className={styles.buttons}>
          <FileInput
            label='Upload Genesis Head'
            icon={<CloudUploadOutlinedIcon />}
            onChange={(data) => setGenesisHead(data)}
            onCancel={() => setGenesisHead(new Uint8Array())}
          />
          <FileInput
            label='Upload Validation Code'
            icon={<CodeOutlinedIcon />}
            onChange={(data) => setWasmCode(data)}
            onCancel={() => setWasmCode(new Uint8Array())}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant='outlined'>
          Cancel
        </Button>

        <ProgressButton
          onClick={onRegister}
          label='Register'
          loading={working}
        />
      </DialogActions>
    </Dialog>
  );
};
