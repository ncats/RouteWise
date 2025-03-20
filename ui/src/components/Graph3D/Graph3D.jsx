import React from "react";
import { ForceGraph3D } from 'react-force-graph';
import { MainContext } from '../contexts/MainContext';

const Graph3D = ({ graphData }) => {
    const { graphSettings } = useContext(MainContext);
    
    return (
        <ForceGraph3D
            graphData={graphData}
            {...graphSettings}
        />
    );
}

export default Graph3D;
