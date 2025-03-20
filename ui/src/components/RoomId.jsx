import React, { useContext } from "react";
import { Typography } from "antd";
import { MainContext } from "../contexts/MainContext";

const { Text } = Typography;

const RoomId = () => {
  const { appSettings } = useContext(MainContext);

  return (
    <Text copyable={{ text: appSettings.roomId }}>
      <b>Room ID:</b> {appSettings.roomId}
    </Text>
  );
};

export default RoomId;
