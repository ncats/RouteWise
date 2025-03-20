import React, { useContext } from "react";
import { ForceGraph2D } from 'react-force-graph';
import { MainContext } from '../../contexts/MainContext';

const Graph2D = ({ graphData }) => {
    const { graphSettings } = useContext(MainContext);

    return (
        <ForceGraph2D
            graphData={graphData}
            {...graphSettings}
        />
    );
}

export { Graph2D };
