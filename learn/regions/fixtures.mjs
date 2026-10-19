import {zlibSync} from 'fflate';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import * as H from '../../src/defs/helpers.js';
export const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..');
export const def=fs.existsSync(path.join(ROOT,'src/defs/nodes/region_hatch.js'))?(await import('../../src/defs/nodes/region_hatch.js')).default:Function(...Object.keys(H),'return '+fs.readFileSync(path.join(ROOT,'nodes-lab/region_hatch.plotternode.js'),'utf8'))(...Object.values(H));
export const defaults=()=>Object.fromEntries(def.params.map(p=>[p.key,p.def]));
// Original teaching artwork: a flat landscape with a sun, coloured hill bands,
// a dark foreground and a pale circular clearing. No external image dependency.
export function image(){const w=160,h=112,g=[],rgb=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const u=x/w,v=y/h;let c=[239,228,201];
 if((u-.77)**2+(v-.24)**2<.09**2)c=[221,147,62];
 if(v>.50+.09*Math.sin(u*7)+.045*Math.sin(u*17))c=[68,146,163];
 if(v>.65+.08*Math.sin(u*9+2))c=[44,84,135];
 if(v>.84+.045*Math.sin(u*13))c=[92,45,130];
 if((u-.23)**2+((v-.73)*1.15)**2<.065**2)c=[239,228,201];
 rgb.push(...c);g.push(1-(.299*c[0]+.587*c[1]+.114*c[2])/255);
 }return {w,h,g,rgb};}
export const lessons=[
 {id:'tonal-regions',title:'Carve an image into tonal regions',summary:'Build a one-pen engraved landscape with closed region contours and a clear hole.',settings:{method:'Posterize',levels:5,smooth:1,minRegion:12,angleMin:15,angleMax:165,colours:1,layer:0},steps:[
 ['Load the source','Add Region Hatch and choose the supplied landscape PNG, or open the finished patch with its image already stored. Set the canvas to A4 wide, 297 × 210 mm.'],
 ['Choose tonal regions','Set Segmentation to Posterize and Tone bands to 5. Adjacent cells in the same band form a region; disconnected islands remain separate.'],
 ['Remove small fragments','Set Resolution to 96, Smooth passes to 1 and Min region cells to 12. Smooth changes the tone field; the minimum merges tiny regions into a neighbouring region.'],
 ['Follow each shape','Use Angle mode Region shape with Angle min 15° and Angle max 165°. Narrow, long regions guide the hatching direction. Fixed uses only Angle min.'],
 ['Inspect the two outputs','The node preview and normal export use Hatching, its first output. Connect Region outlines, the second blue output, to Set Pen to inspect the closed contours. The pale circular clearing remains a hole.'],
 ['Export a sample','Select Region Hatch for hatching, Set Pen for contours, or Merge for both. Export SVG. For a larger final work, use Test crop and set the test paper margin before a 1:1 sample.']
 ],experiments:['Set Tone bands to 3, then 8. Compare region boundaries as well as shading.','Set Angle mode to Fixed and Angle min to 35°. This removes region-to-region rotation.'],pitfalls:['Region contours follow the working cell grid; this is not smooth vector tracing. Higher Resolution adds detail and computation.','Region outlines contains complete region loops. Neighbouring loops share edges, so plotting every outline can retrace those edges.']},
 {id:'four-pen-regions',title:'Draw a four-pen patchwork',summary:'Use compact SLIC regions, four selected ink colours and gently irregular hatch strokes.',settings:{method:'SLIC',cell:13,compact:.14,smooth:1,minRegion:16,colours:4,mapping:'Source colours',layer:4,pen2:6,pen3:1,pen4:5,wobble:.2,wave:8},steps:[
 ['Start with the image','Load the supplied four-pen patch. It stores the original teaching image, so no web service or image upload is needed. A4 wide is 297 × 210 mm.'],
 ['Build compact regions','Set Segmentation to SLIC, Cell size to 13 and Compactness to 0.14. Cell size is measured in working-grid cells, not millimetres. More Compactness makes more regular cells; less follows tonal changes.'],
 ['Select four pens','Set Colours to 4. Use Orange, Teal, Blue and Purple for Pens 1–4. Source colours assigns each region to the closest of these selected colours; it does not blend or overprint inks.'],
 ['Control ink coverage','Set Pen width mm to 0.35, Min spacing mm to 0.5 and Max spacing mm to 4. Mean region darkness controls the line density. Ink strength and Ink gamma tune that approximation.'],
 ['Add a drawn touch','Set Hand wobble mm to 0.2 and Wobble wave mm to 8. The same Wobble seed repeats the drawing. Endpoints stay fixed, and any excursion outside the original region is clipped.'],
 ['Prepare the complete drawing','Select Region Hatch and export SVG for hatch only. The connected Merge adds black outlines from the second output through Set Pen. Keep outlines separate if a cleaner colour field is preferred.']
 ],experiments:['Change Colours to 2 and compare Orange + Teal. Hidden Pen 3 and Pen 4 settings have no effect.','Switch Colour mapping to Tone bands. Pens run from lightest band (Pen 1) to darkest band (Pen 4), independent of the source hue.'],pitfalls:['SLIC here uses image tone and position to form regions. Source colours only assigns the completed regions; similar-brightness colours may share a region.','These are approximate pen densities and screen colours. Make a physical spacing swatch with the chosen pens; dark opaque ink cannot reproduce a pale source merely by changing its preview colour.']}
];
export function patch(l){const nodes=[{id:9002,type:'region_hatch',x:40,y:40,params:{...defaults(),...l.settings,file:'region-landscape.png'},data:{img:image()}},{id:9003,type:'setpen',x:470,y:80,params:{mode:'All',from:0,layer:0},collapsed:true},{id:9004,type:'merge',x:470,y:250,params:{count:2,penPer:false},collapsed:true}],edges=[{id:'outline-pen',from:9002,fromPort:1,to:9003,toPort:0},{id:'hatch-merge',from:9002,fromPort:0,to:9004,toPort:0},{id:'outline-merge',from:9003,fromPort:0,to:9004,toPort:1}];const out={app:'muusia',v:1,name:l.title,canvas:{W:297,H:210},root:{nodes,edges,outputId:9002}};return out;}
export const pages=['regions/index.html',...lessons.map(l=>'regions/'+l.id+'/index.html')];
export function sourcePNG(){const im=image(),crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;},chunk=(s,b)=>{const t=Buffer.from(s),out=Buffer.alloc(12+b.length);out.writeUInt32BE(b.length);t.copy(out,4);b.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,b])),8+b.length);return out;},ih=Buffer.alloc(13);ih.writeUInt32BE(im.w);ih.writeUInt32BE(im.h,4);ih[8]=8;ih[9]=2;const pixels=Buffer.alloc(im.h*(1+im.w*3));for(let y=0;y<im.h;y++)Buffer.from(im.rgb.slice(y*im.w*3,(y+1)*im.w*3)).copy(pixels,y*(1+im.w*3)+1);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',Buffer.from(zlibSync(pixels))),chunk('IEND',Buffer.alloc(0))]);}
if(process.argv.includes('--write')){fs.writeFileSync(path.join(HERE,'assets/region-landscape.png'),sourcePNG());for(const l of lessons)fs.writeFileSync(path.join(HERE,'patches',l.id+'.muusia.json'),JSON.stringify(patch(l),null,2)+'\n');const two=patch(lessons[1]);two.name='Two-pen patchwork';two.root.nodes[0].params.colours=2;fs.writeFileSync(path.join(HERE,'patches/two-pen-regions.muusia.json'),JSON.stringify(two,null,2)+'\n');}
