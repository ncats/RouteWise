import React from "react";
import { Layout} from "antd";
import Settings from "../components/Settings";
import BaseLayoutHeader from "./BaseLayoutHeader";
import MainHeader from "./MainHeader";

const { Header, Content, Footer } = Layout;

const BaseLayout = ({ children }) => {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header className="Main-header-container">
        <MainHeader />
      </Header>
      <Layout>
        <Header style={{ margin: 0, padding: 0, backgroundColor: "#f5f5f5" }}>
          <BaseLayoutHeader />
        </Header>
        <Content>{children}</Content>
        <Footer>
          <Settings />
        </Footer>
      </Layout>
    </Layout>
  );
};

export default BaseLayout;
