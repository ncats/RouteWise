import React, { useEffect, useContext } from "react";
import { Button, Modal, Typography, Flex } from "antd";
import { Editor } from "ketcher-react";
import { StandaloneStructServiceProvider } from "ketcher-standalone";

// context
import { MainContext } from "../../contexts/MainContext";

// styles
import "ketcher-react/dist/index.css";

const { Text } = Typography;

const structServiceProvider = new StandaloneStructServiceProvider();

const KetcherModal = ({ handleInput }) => {
  const { showKetcher, setShowKetcher, setKetcherSmiles, ketcherSmiles } =
    useContext(MainContext);

  useEffect(() => {
    if (!!showKetcher) {
      const intervalId = setInterval(async () => {
        if (window.ketcher) {
          const _smiles = await window.ketcher.getSmiles();

          if (_smiles !== ketcherSmiles) {
            setKetcherSmiles(_smiles);
          }
        }
      }, 500); // Check for changes every 1/2 second

      return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }
  }, [showKetcher]);

  if (!showKetcher) return null;

  const showSmilesHint = () => {
    return (
      <>
        {!!ketcherSmiles ? (
          <>
            <Text>SMILES: </Text>
            <Text code>{ketcherSmiles}</Text>
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </>
    );
  };

  const handleClose = () => {
    setShowKetcher(false);
    window.ketcher.setMolecule("");
  };

  return (
    <Modal
      centered
      closable={false}
      open={showKetcher}
      width="70%"
      height="80%"
      footer={
        <Flex justify="space-between">
          <Flex gap={8}>{showSmilesHint()}</Flex>
          <Flex gap={10}>
            <Button
              onClick={() => {
                handleClose();
                setKetcherSmiles("");
              }}
            >
              Cancel
            </Button>
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                handleClose();
                handleInput({ target: { value: ketcherSmiles } });
              }}
            >
              Done
            </Button>
          </Flex>
        </Flex>
      }
    >
      <div className="ketcherContainer">
        <Editor
          staticResourcesUrl={"/"}
          structServiceProvider={structServiceProvider}
          onInit={(ketcher) => {
            window.ketcher = ketcher;
            window.parent.postMessage(
              {
                eventType: "init",
              },
              "*"
            );
          }}
        />
      </div>
    </Modal>
  );
};

export default KetcherModal;
