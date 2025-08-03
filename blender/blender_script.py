import sounddevice as sd
import numpy as np
import bpy

# parts of code from https://github.com/F1dg3tXD/MAD/blob/main/MAD_OSX/mad.py and https://github.com/CGArtPython/blender_plus_python/blob/main/add-ons/simple_custom_panel/simple_custom_panel.py

def get_microphone_items(self, context):
    items = []
    for i, device in enumerate(sd.query_devices()):
        if device["max_input_channels"] > 0:
            label = f"{i}:{device['name']}"
            items.append((label, device["name"], ""))
    return items

class AudioRigSettings(bpy.types.PropertyGroup):
    mic_list: bpy.props.EnumProperty(
        name="Microphone",
        description="Select input device",
        items=get_microphone_items
    )
    # all of these are not implemented
    object_ref: bpy.props.PointerProperty(
        name="Object",
        type=bpy.types.Object,
        description="Select the target object"
    )
    property_path: bpy.props.StringProperty(
        name="Property Path",
        description="e.g. 'location.0', 'rotation_euler.2', 'scale[0]'",
        default="location.0"
    )
    bone_name: bpy.props.EnumProperty(
        name="Bone",
        description="Select bone to drive (if Armature)",
        items=lambda self, context: (
            [(b.name, b.name, "") for b in self.object_ref.pose.bones]
            if self.object_ref and self.object_ref.type == 'ARMATURE' and hasattr(self.object_ref, "pose") else []
        )
    )
    volume_scale: bpy.props.FloatProperty(name="Volume to Value Scale", default=1.0)
    update_interval: bpy.props.FloatProperty(name="Update Interval (s)", default=0.05, min=0.001, max=1.0)


# property group for selecting color channel
# TODO: make it show up depending on selected output
class color_channel_settings(bpy.types.PropertyGroup):
    channel_list: bpy.props.EnumProperty(
        name="Channels",
        description="Select color channel",
        items=[("RED", "Red", ""), ("GREEN", "Green", ""), ("BLUE", "Blue", "")]
    )

# button for changing color based on sound level
class BRUSH_OT_change_brush_color(bpy.types.Operator):
    bl_idname = "brush.change_brush_color"
    bl_label = "Change Brush Color"
    bl_description = "Use audio input to set a random brush color"
    bl_options = {'REGISTER', 'UNDO'}
    
    def execute(self, context):
        try:
            duration = 1
            sample_rate = 44100
            audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
            sd.wait()
            audio = np.array(audio).flatten()
            print('audio:', audio)
            normalized_audio = (audio - np.min(audio)) / (np.max(audio) - np.min(audio))
            print('normalized audio:', normalized_audio)

            rms = np.linalg.norm(audio) / np.sqrt(len(audio))
            print("RMS Volume:", rms)

            def safe_sample():
                return float(np.random.choice(normalized_audio))
            
            # logic for changing one channel
            channel_choice = context.scene.my_tool.channel_list
            brush = bpy.data.brushes.get("Tint")
            
            if not brush:
                self.report({'WARNING'}, "Brush Tint not found.")
                return {'CANCELLED'}

            r, g, b = brush.color
            print("old brush rgb", r, g, b)
            new_value = safe_sample()
            
            if channel_choice == "RED":
                r = new_value
            elif channel_choice == "GREEN":
                g = new_value
            elif channel_choice == "BLUE":
                b = new_value
            
            print("new brush rgb", r, g, b)
            brush.color = (r, g, b)

            return {'FINISHED'}

        except Exception as e:
            self.report({'ERROR'}, f"Error: {str(e)}")
               

# Main panel UI
class VIEW3D_PT_creative_constraints(bpy.types.Panel):  # class naming convention ‘CATEGORY_PT_name’

    # where to add the panel in the UI
    bl_space_type = "VIEW_3D"  # 3D Viewport area (find list of values here https://docs.blender.org/api/current/bpy_types_enum_items/space_type_items.html#rna-enum-space-type-items)
    bl_region_type = "UI"  # Sidebar region (find list of values here https://docs.blender.org/api/current/bpy_types_enum_items/region_type_items.html#rna-enum-region-type-items)

    bl_category = "Creative Constraints"  # found in the Sidebar
    bl_label = "Input to Output Mapping"  # found at the top of the Panel

    def draw(self, context): # function that defines layout
        layout = self.layout
        scene = context.scene
        color_channel_settings = scene.color_channel
        audio_rig = scene.audio_rig
        
        layout.label(text="Select Microphone:")
        layout.prop(audio_rig, "mic_list")
        
        layout.label(text="Set Brush Color from Audio:")
        layout.prop(color_channel_settings, "channel_list")
        
        layout.operator("brush.change_brush_color", text="Change Brush Color")
        
classes = (
    AudioRigSettings,
    color_channel_settings,
    BRUSH_OT_change_brush_color,
    VIEW3D_PT_creative_constraints,
)
        

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.color_channel = bpy.props.PointerProperty(type= color_channel_settings) # this creates a variable that can be referenced
    bpy.types.Scene.audio_rig = bpy.props.PointerProperty(type= AudioRigSettings)

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()