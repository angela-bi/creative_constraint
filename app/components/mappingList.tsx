import React, { useState, useEffect } from "react";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Color } from "../page";

export type Input = "sound" | "brightness" | "nothing"
export type Mapping = {id: number, color: Color, input: Input, image_path: string, pos: {x: number, y: number}}

type MappingProps = {
    colors: Color[];
    setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export function MappingList({ colors, setActiveColor }: MappingProps) {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const MAX_MAPPINGS = 4; // when we reach this number, stop rendering + sign
    const [activeMappingId, setActiveMappingId] = useState<number | null>(null); // this is the id number of the mapping who the user is selecting a color for

    // populating mappings
    useEffect(() => {
        const positions = [
            { x: 50, y: 580 }, // pink
            { x: 260, y: 480 }, // blue
            { x: 450, y: 600 }, // green
        ];

        if (!colors || colors.length === 0) return;
        const initialMappings = colors.slice(1, MAX_MAPPINGS ).map((color, index) => ({ // excluding first color, white
          id: index,
          color,
          input: "nothing" as Input,
          image_path: "", // placeholder
          pos: positions[index]
        }));
        setMappings(initialMappings);
      }, [colors]);
       

    // when color button is clicked
    const handleColorButtonClick = (
        event: React.MouseEvent<HTMLElement>,
        id: number
      ) => {
        setActiveMappingId(id);
    };

    // when color is selected from menu
    const handleColorSelect = (color: Color) => {
        if (activeMappingId === null) return;
        setMappings((prev) =>
          prev.map((m) =>
            m.id === activeMappingId ? { ...m, color } : m
          )
        );
        // handleClose();
    };

    return (
        <div>
            <div
            style={{
                position: "fixed",
                bottom: "-150px",
                left: "0px",
                zIndex: 10,
                width: "700px",
                height: '500px',
                backgroundImage: "url('/images/palette.png')",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                display: "flex",
                flexDirection: "column",
                transform: "rotate(20deg) scale(1.4)",
            }}
            />
            {mappings.map((mapping) => {
                const { id, color, input, image_path, pos } = mapping;
                console.log(mapping)

                return (
                    <div
                        key={id}
                        style={{
                            position: 'absolute',
                            zIndex: 20,
                            top: `${pos.y}px`,
                            left: `${pos.x}px`,
                            // backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                            backgroundImage: `url('/images/ellipse_${color.name}.png')`,
                            width: "200px",
                            height: "200px",
                            backgroundSize: "contain",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            cursor: "pointer",
                            clipPath: "circle(50% at 50% 50%)"
                        }}
                        onClick={(e) => handleColorButtonClick(e, id)}
                    />
                )
            })}
        </div>
    )
}