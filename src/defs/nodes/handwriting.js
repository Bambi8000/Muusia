import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "handwriting",
  name: "Handwriting",
  cat: "gen",
  group: "textimg",
  desc: "Original pen-stroke handwriting in Cursive or Print. Case is preserved, including Finnish ä, ö and å. Each occurrence has seeded differences in letter shape, width, height, slant and rhythm; a few letters also have alternate constructions. Variation 0 uses the regular master shapes. Cursive joins connects lowercase bodies within each word; dots, accents and crossbars are written after the word. Capitals, punctuation, spaces and line breaks lift the pen. These are real open pen paths, not a filled outline font. Lowercase height sets the requested x-height; the whole text only shrinks if needed to fit the margin. Wrap breaks at words and splits oversized words. Use | or a newline for explicit lines, up to 1200 characters. Keep Seed fixed for a repeatable hand, or wire it for a newly written version. Unsupported characters get a visible question mark.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Writing")],
  params: [
    {key:"text",label:"Text (| = new line; max 1200)",type:"text",def:"Every line is a little different.|Even when the words repeat."},
    {key:"mode",label:"Hand",type:"select",options:["Cursive","Print"],def:"Cursive"},
    {key:"size",label:"Lowercase height mm",type:"slider",min:2,max:30,step:0.5,def:7.5},
    {key:"variation",label:"Variation %",type:"slider",min:0,max:100,step:1,def:55},
    {key:"slant",label:"Slant °",type:"slider",min:-20,max:35,step:1,def:12},
    {key:"sway",label:"Baseline sway %",type:"slider",min:0,max:100,step:1,def:22},
    {key:"joins",label:"Cursive joins",type:"check",def:true,showIf:p=>p.mode==="Cursive"},
    {key:"tracking",label:"Letter spacing ×",type:"slider",min:0.7,max:1.8,step:0.05,def:1},
    {key:"wordspace",label:"Word spacing ×",type:"slider",min:0.6,max:2,step:0.05,def:1},
    {key:"lineh",label:"Line spacing ×",type:"slider",min:2.3,max:4.5,step:0.1,def:3},
    {key:"wrap",label:"Wrap to paper",type:"check",def:true},
    {key:"align",label:"Align",type:"select",options:["Left","Center","Right"],def:"Left"},
    {key:"position",label:"Vertical position %",type:"slider",min:0,max:100,step:1,def:50},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:15},
    {key:"seed",label:"Seed",type:"seed",def:37},
    {key:"layer",label:"Pen",type:"pen",def:0},
  ],
  overlay(p,ctx) {
    const m=Number.isFinite(+p.margin)?Math.max(0,Math.min(60,+p.margin)):15;
    return Number.isFinite(ctx.W)&&Number.isFinite(ctx.H)&&ctx.W>2*m&&ctx.H>2*m
      ?[{kind:"rect",x:m,y:m,w:ctx.W-2*m,h:ctx.H-2*m}]:[];
  },
  _alphabet(mode) {
    // Authored centreline masters: x-height 1, y up, baseline 0. No font assets.
    // Each command string is one pen stroke. Only lowercase cursive body 0 joins.
    const G=(w,...s)=>({w,s});
    const caps={
      A:G(1.05,"M .02 0 Q .3 .8 .52 1.52 Q .7 .75 1.02 0","M .23 .53 Q .56 .56 .82 .54"),
      B:G(.95,"M .1 0 Q .14 .8 .12 1.48 C 1.1 1.63 1.1 .75 .16 .77 C 1.28 .91 1.19 -.15 .1 0"),
      C:G(1,"M .98 1.27 C .65 1.77 -.03 1.37 .05 .61 C .04 -.03 .74 -.18 1 .22"),
      D:G(1.05,"M .12 0 Q .14 .8 .12 1.48 C 1.38 1.66 1.37 -.16 .12 0"),
      E:G(.89,"M .87 1.47 Q .4 1.51 .12 1.46 L .1 .02 Q .45 -.02 .9 .03","M .11 .78 Q .45 .8 .74 .77"),
      F:G(.87,"M .13 0 Q .16 .81 .13 1.47 Q .5 1.52 .88 1.47","M .14 .79 Q .49 .81 .75 .78"),
      G:G(1.08,"M .97 1.28 C .66 1.72 -.02 1.39 .04 .65 C .03 -.08 .92 -.24 1.01 .31 L 1.02 .69 L .62 .67"),
      H:G(1.05,"M .13 1.5 Q .09 .69 .12 0","M .96 1.5 Q .91 .74 .95 0","M .12 .73 Q .6 .77 .94 .74"),
      I:G(.48,"M .25 1.48 Q .19 .73 .23 0","M .04 1.48 L .46 1.5","M .01 0 L .45 .01"),
      J:G(.85,"M .78 1.49 Q .82 .7 .73 .23 C .64 -.12 .16 -.07 .05 .24","M .42 1.49 L .94 1.51"),
      K:G(1,"M .13 1.49 Q .11 .79 .12 0","M .94 1.5 L .14 .63","M .48 .97 Q .76 .4 1.01 .02"),
      L:G(.86,"M .14 1.5 Q .08 .76 .13 .02 Q .49 -.01 .89 .03"),
      M:G(1.32,"M .08 0 L .15 1.49 Q .5 .78 .66 .47 Q .94 1.05 1.16 1.5 L 1.26 0"),
      N:G(1.13,"M .12 0 L .13 1.5 Q .58 .91 1 .01 L .99 1.51"),
      O:G(1.13,"M .59 1.51 C -.1 1.53 -.11 .04 .54 -.02 C 1.24 -.04 1.29 1.46 .59 1.51"),
      P:G(.94,"M .12 0 Q .14 .8 .12 1.49 C 1.16 1.69 1.19 .64 .14 .77"),
      Q:G(1.16,"M .59 1.51 C -.1 1.53 -.11 .04 .54 -.02 C 1.24 -.04 1.29 1.46 .59 1.51","M .67 .29 Q .91 .01 1.2 -.2"),
      R:G(1.02,"M .12 0 Q .14 .8 .12 1.49 C 1.16 1.69 1.19 .64 .14 .77","M .5 .78 Q .8 .29 1.03 0"),
      S:G(.98,"M .95 1.27 C .68 1.68 .03 1.56 .07 1.11 C .08 .67 1.04 .83 .99 .3 C .95 -.17 .27 -.13 .03 .21"),
      T:G(1.05,"M .02 1.48 Q .54 1.51 1.06 1.48","M .56 1.48 Q .49 .68 .53 0"),
      U:G(1.1,"M .12 1.5 L .1 .4 C .12 -.19 1.03 -.2 1.01 .43 L 1.02 1.5"),
      V:G(1.05,"M .04 1.48 Q .27 .68 .53 .01 Q .81 .75 1.04 1.5"),
      W:G(1.52,"M .03 1.5 L .34 0 L .74 1.23 L 1.11 0 L 1.51 1.48"),
      X:G(1,"M .03 1.5 Q .51 .73 1 0","M .98 1.51 Q .46 .7 .02 0"),
      Y:G(1.04,"M .02 1.5 L .51 .72 L 1.04 1.5","M .51 .72 Q .49 .34 .51 0"),
      Z:G(1,"M .03 1.48 Q .54 1.51 1 1.48 L .02 .01 Q .52 -.01 1.03 .02"),
    };
    const print={
      a:G(.78,"M .64 .8 C .27 1.24 -.09 .7 .08 .2 C .3 -.23 .75 .08 .66 .58 L .65 1 L .67 0"),
      b:G(.8,"M .12 1.62 L .11 .03","M .12 .73 C .67 1.4 1.03 .58 .64 .11 Q .33 -.13 .13 .14"),
      c:G(.73,"M .7 .82 C .33 1.25 -.06 .81 .09 .3 Q .26 -.17 .73 .17"),
      d:G(.81,"M .66 .79 C .25 1.24 -.08 .69 .08 .2 C .31 -.23 .73 .07 .66 .61 L .68 1.65 L .68 .01"),
      e:G(.77,"M .1 .5 L .72 .54 C .78 1.22 .02 1.12 .06 .47 Q .12 -.22 .76 .15"),
      f:G(.57,"M .21 -.02 L .23 1.28 Q .29 1.79 .68 1.52","M .02 .99 Q .3 1 .58 1.01"),
      g:G(.8,"M .64 .83 C .25 1.25 -.08 .71 .07 .22 C .29 -.2 .73 .09 .66 .61 L .65 -.35 Q .52 -.86 .05 -.51"),
      h:G(.81,"M .12 1.63 L .1 0","M .12 .66 C .33 1.24 .74 1.05 .7 .53 L .7 .01"),
      i:G(.29,"M .14 .96 Q .12 .47 .15 0","M .13 1.36 L .16 1.39"),
      j:G(.36,"M .25 .97 L .23 -.34 Q .18 -.77 -.18 -.56","M .23 1.36 L .26 1.39"),
      k:G(.76,"M .11 1.63 L .1 0","M .74 1 L .13 .4","M .39 .66 L .79 0"),
      l:G(.3,"M .12 1.62 Q .08 .71 .15 0"),
      m:G(1.17,"M .09 0 L .1 1 L .11 .7 C .29 1.25 .61 1.02 .56 .54 L .56 0","M .57 .68 C .81 1.25 1.09 1.04 1.07 .52 L 1.07 0"),
      n:G(.8,"M .1 0 L .1 1 L .11 .68 C .35 1.26 .75 1.04 .7 .52 L .71 0"),
      o:G(.81,"M .42 1.01 C -.09 1.05 -.09 .03 .36 -.02 C .92 -.06 .94 .99 .42 1.01"),
      p:G(.81,"M .12 -.62 L .12 1","M .13 .75 C .7 1.42 1.02 .51 .62 .1 Q .32 -.12 .13 .16"),
      q:G(.81,"M .66 .79 C .27 1.23 -.06 .71 .07 .22 C .29 -.21 .73 .06 .66 .58 L .66 1 L .68 -.62"),
      r:G(.62,"M .12 0 L .12 1 L .12 .67 Q .33 1.13 .66 .94"),
      s:G(.71,"M .68 .84 C .36 1.17 .03 1 .09 .72 C .15 .44 .75 .6 .7 .23 Q .63 -.16 .04 .13"),
      t:G(.57,"M .26 1.4 L .24 .21 Q .3 -.12 .63 .1","M .02 .95 L .57 .98"),
      u:G(.81,"M .1 1 L .1 .29 C .12 -.22 .61 -.09 .69 .38 L .69 1 L .71 0"),
      v:G(.76,"M .03 1 Q .17 .47 .37 0 Q .62 .52 .77 1"),
      w:G(1.15,"M .03 1 L .27 0 L .57 .82 L .85 0 L 1.14 1"),
      x:G(.75,"M .03 1 Q .38 .45 .75 0","M .73 1 Q .33 .43 .02 0"),
      y:G(.77,"M .03 1 L .35 .03","M .76 1 Q .45 .11 .13 -.62"),
      z:G(.75,"M .03 .98 L .74 1 L .04 0 L .76 .02"),
    };
    const cursive={
      a:G(.83,"M 0 0 C .19 .2 .21 1.04 .58 1 C .88 .94 .53 -.13 .25 .05 C -.02 .24 .14 1.12 .63 .93 C .56 .53 .55 .05 .83 0"),
      b:G(.83,"M 0 0 C .24 .38 .59 1.93 .29 1.68 C .02 1.5 .18 .23 .35 .05 C .77 -.28 1.08 .87 .6 .95 Q .33 .97 .28 .56 C .37 .2 .57 -.04 .83 0"),
      c:G(.76,"M 0 0 C .18 .26 .22 1.07 .65 .99 C .8 .96 .77 .8 .64 .8 C .27 1.11 .08 .36 .26 .12 Q .46 -.12 .76 0"),
      d:G(.86,"M 0 0 C .15 .3 .25 1.1 .61 .97 C .85 .85 .49 -.15 .23 .06 C -.01 .31 .19 1.09 .64 .95 C .85 2.01 .54 1.92 .55 1.38 C .53 .82 .56 -.06 .86 0"),
      e:G(.72,"M 0 0 C .17 .24 .76 .74 .56 .92 C .35 1.13 .12 .73 .17 .38 Q .26 -.1 .72 0"),
      f:G(.72,"M 0 0 C .29 .46 .72 1.96 .4 1.7 C .15 1.51 .28 .2 .26 -.4 C .28 -.85 .69 -.65 .55 -.3 Q .41 -.02 .72 0","M .05 .85 Q .41 .9 .78 .93"),
      g:G(.84,"M 0 0 C .2 .33 .25 1.07 .61 .96 C .84 .82 .49 -.16 .23 .06 C -.02 .3 .18 1.1 .64 .94 L .56 -.36 C .5 -.94 .02 -.66 .17 -.4 C .31 -.17 .59 -.05 .84 0"),
      h:G(.86,"M 0 0 C .25 .48 .61 1.95 .29 1.68 C .08 1.46 .19 .39 .2 0 C .43 1.36 .94 1.16 .66 .4 Q .55 -.08 .86 0"),
      i:G(.45,"M 0 0 Q .21 .46 .24 .98 C .14 .52 .14 -.08 .45 0","M .26 1.34 L .29 1.38"),
      j:G(.48,"M 0 0 Q .25 .53 .28 .98 L .18 -.36 C .06 -.96 -.37 -.6 -.16 -.39 Q .15 -.14 .48 0","M .3 1.34 L .33 1.38"),
      k:G(.83,"M 0 0 C .23 .4 .59 1.96 .28 1.68 C .08 1.44 .17 .32 .21 0 C .23 .49 .71 1.2 .7 .82 Q .65 .51 .26 .47 C .72 .52 .41 -.06 .83 0"),
      l:G(.5,"M 0 0 C .24 .36 .63 1.93 .3 1.67 C .03 1.45 .08 -.08 .5 0"),
      m:G(1.25,"M 0 0 Q .19 .46 .19 .98 L .16 .08 C .32 1.29 .76 1.23 .57 .35 L .54 .05 C .81 1.32 1.22 1.17 1.04 .37 Q .92 -.08 1.25 0"),
      n:G(.86,"M 0 0 Q .18 .43 .2 .98 L .16 .05 C .45 1.35 .92 1.17 .67 .36 Q .57 -.08 .86 0"),
      o:G(.82,"M 0 0 C .15 .3 .22 1.1 .6 1 C 1.01 .87 .56 -.2 .25 .05 C -.04 .3 .19 1.13 .61 .97 C .85 .86 .47 .45 .82 0"),
      p:G(.87,"M 0 0 Q .2 .39 .22 .97 L .08 -.64 L .25 .64 C .63 1.47 1.08 .64 .65 .11 Q .35 -.13 .26 .2 Q .54 -.03 .87 0"),
      q:G(.86,"M 0 0 C .16 .31 .27 1.08 .61 .96 C .83 .83 .48 -.16 .24 .06 C .01 .29 .16 1.09 .65 .94 L .53 -.62 Q .49 -.29 .86 0"),
      r:G(.73,"M 0 0 Q .22 .39 .28 .98 C .32 .73 .6 .72 .63 .95 Q .54 .62 .47 .23 Q .46 -.05 .73 0"),
      s:G(.74,"M 0 0 C .2 .35 .48 .57 .51 1.02 C .45 .73 .14 .54 .26 .19 C .39 -.16 .7 .08 .63 .33 Q .6 .04 .74 0"),
      t:G(.59,"M 0 0 Q .23 .56 .36 1.45 C .23 .72 .15 -.12 .59 0","M .03 .92 Q .36 .96 .66 .99"),
      u:G(.86,"M 0 0 Q .19 .4 .24 1 C .02 .24 .2 -.31 .63 .27 L .74 1 C .55 .47 .52 -.05 .86 0"),
      v:G(.81,"M 0 0 Q .22 .42 .22 1 C .12 .37 .25 -.1 .45 .04 Q .74 .23 .78 .99 Q .6 .42 .81 0"),
      w:G(1.17,"M 0 0 Q .17 .35 .21 1 C .01 .27 .17 -.22 .52 .19 L .64 .95 C .49 .25 .56 -.2 .85 .14 Q 1.05 .36 1.1 .99 Q .96 .35 1.17 0"),
      x:G(.8,"M 0 0 Q .32 .19 .65 1 Q .27 .63 .36 .22 Q .43 -.05 .8 0","M .15 .92 Q .27 .61 .65 .12"),
      y:G(.86,"M 0 0 Q .19 .41 .24 1 C .04 .27 .17 -.27 .61 .26 L .75 1 L .54 -.38 C .42 -.99 -.04 -.63 .16 -.37 Q .41 -.05 .86 0"),
      z:G(.78,"M 0 0 Q .15 .36 .2 .95 Q .46 1.06 .65 .91 L .26 .37 C .91 .64 .76 -.38 .35 -.62 C .02 -.8 .12 -.24 .44 -.12 Q .62 -.03 .78 0"),
    };
    const common={
      '0':G(.82,"M .46 1.45 C -.08 1.5 -.1 .04 .36 -.02 C .98 -.09 1.03 1.44 .46 1.45"),
      '1':G(.57,"M .06 1.12 L .35 1.46 L .3 .01","M .08 .01 L .59 .03"),
      '2':G(.87,"M .06 1.15 C .12 1.66 .94 1.57 .82 1.02 Q .79 .71 .08 .03 Q .55 -.02 .9 .03"),
      '3':G(.84,"M .07 1.26 C .58 1.77 1.24 1.01 .41 .8 C 1.27 .8 1.05 -.33 .05 .13"),
      '4':G(.89,"M .61 1.5 L .03 .48 L .91 .5","M .69 1.5 L .65 0"),
      '5':G(.86,"M .83 1.45 L .17 1.43 L .12 .78 C 1.12 1.12 1.12 -.32 .03 .13"),
      '6':G(.86,"M .73 1.45 C .11 1.42 -.16 -.09 .44 -.02 C 1.09 .04 .88 1.08 .23 .71"),
      '7':G(.88,"M .02 1.46 L .88 1.46 Q .47 .68 .26 0","M .21 .69 L .72 .72"),
      '8':G(.87,"M .42 .78 C -.29 1.04 .18 1.81 .69 1.36 C 1.08 1.01 .27 .66 .12 .37 C -.2 -.31 1.12 -.11 .78 .45 Q .68 .66 .42 .78"),
      '9':G(.87,"M .65 .72 C -.05 .32 -.17 1.46 .4 1.48 C 1.14 1.53 .92 .03 .2 -.05"),
      '.':G(.25,"M .1 .01 L .14 .04"), ',':G(.28,"M .15 .04 Q .21 -.13 .03 -.25"),
      '!':G(.3,"M .18 1.48 L .13 .37","M .12 .02 L .15 .05"),
      '?':G(.73,"M .03 1.23 C .13 1.7 .92 1.49 .69 1.02 Q .34 .71 .33 .37","M .31 .02 L .35 .05"),
      ':':G(.28,"M .12 .77 L .15 .8","M .11 .02 L .14 .05"),
      ';':G(.28,"M .12 .77 L .15 .8","M .15 .04 Q .21 -.13 .03 -.25"),
      '-':G(.6,"M .04 .5 Q .3 .52 .59 .5"),
      '+':G(.8,"M .04 .6 L .79 .62","M .43 1 L .41 .2"),
      '=':G(.8,"M .04 .78 L .79 .8","M .04 .38 L .79 .4"),
      '/':G(.65,"M .02 -.14 L .64 1.56"),
      '(':G(.45,"M .4 1.6 Q -.15 .7 .33 -.3"), ')':G(.45,"M .05 1.6 Q .6 .7 .12 -.3"),
      "'":G(.24,"M .15 1.48 L .07 1.16"),
      '"':G(.42,"M .14 1.48 L .06 1.16","M .38 1.48 L .3 1.16"),
      '&':G(1.1,"M 1.08 .12 C .81 -.1 -.14 .71 .22 1.27 C .51 1.75 .94 1.17 .48 .77 C -.36 .15 .24 -.4 .93 .26 L 1.11 .61"),
      '@':G(1.35,"M .94 .82 C .38 1.28 .21 .2 .67 .19 Q .94 .2 .95 .88 L .9 .38 C .93 .01 1.44 .37 1.25 .97 C .96 1.81 -.19 1.57 .01 .56 Q .16 -.25 1.14 -.05"),
    };
    const selected=mode==="Print"?print:cursive, all={...caps,...selected,...common};
    // Explicit alternates change construction, in addition to the continuous hand variation.
    const alternatives=mode==="Print"?{
      a:G(.78,"M .1 .83 C .3 1.17 .75 1.08 .66 .68 L .65 0","M .65 .62 C -.11 .75 -.06 -.17 .49 .03 Q .63 .09 .65 .28"),
      g:G(.8,"M .64 .84 C .26 1.25 -.07 .7 .08 .2 C .28 -.22 .73 .09 .66 .6 L .64 -.12 C .12 .05 .05 -.78 .58 -.64 Q .94 -.54 .64 -.12"),
      t:G(.57,"M .27 1.45 L .23 -.02","M .03 .95 L .59 .98"),
      r:G(.62,"M .13 0 L .1 .99","M .12 .62 Q .23 1.08 .63 .96"),
      y:G(.77,"M .08 1 C -.02 .09 .46 -.21 .64 .33 L .73 1 L .62 -.35 Q .49 -.81 .04 -.53"),
    }:{
      a:G(.84,"M 0 0 C .25 .28 .17 1.01 .57 .99 C .88 .97 .6 .1 .3 .07 C -.06 .04 .13 .83 .59 .77 L .58 .22 Q .61 -.07 .84 0"),
      e:G(.72,"M 0 0 C .28 .34 .75 .69 .52 .85 C .27 1.04 .12 .61 .21 .3 Q .34 -.1 .72 0"),
      r:G(.77,"M 0 0 Q .2 .51 .26 1.05 Q .25 .68 .55 .85 Q .88 1.07 .57 .57 C .39 .15 .48 -.05 .77 0"),
      s:G(.77,"M 0 0 C .39 .26 .61 .78 .45 .99 C .39 .76 .07 .58 .24 .26 C .45 -.11 .74 .12 .53 .34 Q .56 .05 .77 0"),
      t:G(.62,"M 0 0 Q .27 .43 .38 1.44 Q .13 .18 .62 0","M .08 .96 Q .39 1 .69 .98"),
    };
    return {all,alternatives};
  },
  compute(ins,p,ctx) {
    const val=(key,def,lo,hi)=>Number.isFinite(+p[key])?Math.max(lo,Math.min(hi,+p[key])):def;
    const W=ctx.W,H=ctx.H,m=val('margin',15,0,60);
    if(!Number.isFinite(W)||!Number.isFinite(H)||W<=2*m||H<=2*m) return EMPTY;
    const text=String(p.text??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\|/g,'\n').replace(/\t/g,'    ');
    if(!text.trim()||Array.from(text).length>1200) return EMPTY;
    const size=val('size',7.5,2,30),v=val('variation',55,0,100)/100;
    const sway=val('sway',22,0,100)/100,slant=val('slant',12,-20,35)*Math.PI/180;
    const tracking=val('tracking',1,.7,1.8),ws=val('wordspace',1,.6,2),lh=val('lineh',3,2.3,4.5);
    const rnd=mulberry32(val('seed',37,-2147483648,2147483647)|0),mode=p.mode==='Print'?'Print':'Cursive';
    const {all,alternatives}=this._alphabet(mode),canJoin=mode==='Cursive'&&!!p.joins;
    const gap=(mode==='Cursive'?.08:.2)*tracking,space=.63*ws;
    const accents={ 'ä':['a','dia'], 'ö':['o','dia'], 'å':['a','ring'], 'Ä':['A','dia'], 'Ö':['O','dia'], 'Å':['A','ring'],
      'ü':['u','dia'],'Ü':['U','dia'],'é':['e','acute'],'É':['E','acute'],'è':['e','grave'],'È':['E','grave'],
      'á':['a','acute'],'Á':['A','acute'],'à':['a','grave'],'ó':['o','acute'],'Ó':['O','acute'],'í':['i','acute'],'ú':['u','acute'],
      'ñ':['n','tilde'],'Ñ':['N','tilde'],'ç':['c','cedilla'],'Ç':['C','cedilla']};
    const aliases={'’':"'",'‘':"'",'“':'"','”':'"','–':'-','—':'-','−':'-','…':'...','\u00a0':' '};
    const chars=Array.from(text).flatMap(c=>Array.from(aliases[c]??c));
    if(chars.length>1200)return EMPTY;
    // Random values are allocated per source occurrence, before wrapping or sampling.
    const items=chars.map(ch=>{
      if(ch==='\n'||ch===' ') return {ch,advance:ch===' '?space:0};
      const [base,accent]=accents[ch]||[ch,null],known=all[base]?base:'?';
      const r=Array.from({length:9},()=>rnd()*2-1);
      const alt=alternatives[known]&&v>0&&rnd()<v*.7;
      const glyph=alt?alternatives[known]:all[known];
      const sx=1+v*r[0]*.1,sy=1+v*r[1]*.09;
      return {ch,base:known,accent,glyph,sx,sy,r,advance:glyph.w*sx+gap,join:/^[a-z]$/.test(known)};
    });
    const limit=(W-2*m)/size,lines=[[]];let width=0;
    const newline=()=>{lines.push([]);width=0;};
    // Greedy word wrapping preserves explicit empty lines; an oversized word splits between letters.
    for(let i=0;i<items.length;){
      if(items[i].ch==='\n'){newline();i++;continue;}
      if(items[i].ch===' '){if(!p.wrap||width>0){lines.at(-1).push(items[i]);width+=space;}i++;continue;}
      let j=i;while(j<items.length&&items[j].ch!==' '&&items[j].ch!=='\n')j++;
      const word=items.slice(i,j),ww=word.reduce((s,q)=>s+q.advance,0);
      if(p.wrap&&width>0&&width+ww>limit)newline();
      for(const item of word){if(p.wrap&&width>0&&width+item.advance>limit)newline();lines.at(-1).push(item);width+=item.advance;}
      i=j;
    }
    // Curve flattening uses the same tolerance for every glyph, raised uniformly if needed.
    const flatten=(str,step)=>{
      const t=str.match(/[MLQC]|[-+]?(?:\d*\.\d+|\d+\.?\d*)/g)||[],pts=[];let at=0,x=0,y=0;
      while(at<t.length){const cmd=t[at++];if(cmd==='M'||cmd==='L'){x=+t[at++];y=+t[at++];pts.push([x,y]);continue;}
        const x0=x,y0=y,cx=+t[at++],cy=+t[at++];
        let dx,dy;if(cmd==='C'){dx=+t[at++];dy=+t[at++];}x=+t[at++];y=+t[at++];
        const length=Math.hypot(cx-x0,cy-y0)+(cmd==='C'?Math.hypot(dx-cx,dy-cy)+Math.hypot(x-dx,y-dy):Math.hypot(x-cx,y-cy));
        const n=Math.max(2,Math.min(100,Math.ceil(length/step)));
        for(let k=1;k<=n;k++){const z=k/n,a=1-z;pts.push(cmd==='C'?[a*a*a*x0+3*a*a*z*cx+3*a*z*z*dx+z*z*z*x,a*a*a*y0+3*a*a*z*cy+3*a*z*z*dy+z*z*z*y]:[a*a*x0+2*a*z*cx+z*z*x,a*a*y0+2*a*z*cy+z*z*y]);}
      }return pts;
    };
    const build=step=>{
      const output=[];let count=0;
      for(let li=0;li<lines.length;li++){
        const out=[],deferred=[];let cursor=0,body=null;
        const flush=()=>{out.push(...deferred.splice(0));body=null;};
        for(const it of lines[li]){
          if(!it.glyph){flush();cursor+=it.advance;continue;}
          const {glyph,r,sx,sy}=it;
          const angle=v*r[2]*.035,cs=Math.cos(angle),sn=Math.sin(angle),sk=Math.tan(slant+v*r[3]*.07);
          const base=v*r[4]*.035+sway*.12*Math.sin(cursor*.65+li*.8);
          const map=([x,y])=>{
            let xx=x*sx+sk*y*sy+v*.018*(Math.sin(y*3+r[5]*3)-Math.sin(r[5]*3));
            let yy=y*sy+v*.018*(Math.sin(x*4+r[6]*3)-Math.sin(r[6]*3));
            return [cursor+xx*cs-yy*sn,li*lh-(xx*sn+yy*cs+base)];
          };
          const strokes=glyph.s.map(s=>flatten(s,step).map(map));
          if(it.accent){
            const y=/^[A-Z]$/.test(it.base)?1.82:1.34,c=glyph.w*.5;
            const mark=it.accent==='dia'?[`M ${c-.17} ${y} L ${c-.14} ${y+.035}`,`M ${c+.16} ${y} L ${c+.19} ${y+.035}`]
              :it.accent==='ring'?[`M ${c} ${y-.1} C ${c-.24} ${y-.1} ${c-.24} ${y+.19} ${c} ${y+.19} C ${c+.24} ${y+.19} ${c+.24} ${y-.1} ${c} ${y-.1}`]
              :it.accent==='acute'?[`M ${c-.08} ${y-.05} L ${c+.17} ${y+.18}`]
              :it.accent==='grave'?[`M ${c+.08} ${y-.05} L ${c-.17} ${y+.18}`]
              :it.accent==='tilde'?[`M ${c-.28} ${y} Q ${c-.12} ${y+.22} ${c+.02} ${y} Q ${c+.16} ${y-.17} ${c+.28} ${y+.04}`]
              :[`M ${c} -.08 Q ${c+.25} -.42 ${c-.12} -.39`];
            strokes.push(...mark.map(s=>flatten(s,step).map(map)));
          }
          if(canJoin&&it.join){
            if(body){
              const a=body.pts.at(-1),b=strokes[0][0],dx=b[0]-a[0],dy=b[1]-a[1];
              // Gentle baseline bridge; no random point noise or separate join segments.
              const bridge=flatten(`M ${a[0]} ${a[1]} C ${a[0]+dx*.4} ${a[1]+dy*.15} ${b[0]-dx*.4} ${b[1]-dy*.15} ${b[0]} ${b[1]}`,step);
              body.pts.push(...bridge.slice(1),...strokes[0].slice(1));
            }else{body={pts:strokes[0],closed:false,layer:0};out.push(body);}
            deferred.push(...strokes.slice(1).map(pts=>({pts,closed:false,layer:0})));
          }else{flush();out.push(...strokes.map(pts=>({pts,closed:false,layer:0})));}
          cursor+=it.advance;
        }flush();
        let x0=Infinity,x1=-Infinity;for(const pth of out)for(const q of pth.pts){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);}
        for(const pth of out)count+=pth.pts.length;
        output.push({paths:out,x0,x1});
      }
      return {output,count};
    };
    let step=.065,result=build(step);
    for(let i=0;result.count>110000&&i<5;i++){step*=Math.max(1.3,result.count/100000);result=build(step);}
    if(result.count>110000)return EMPTY;
    let y0=Infinity,y1=-Infinity,bw=0;
    for(const line of result.output){if(line.paths.length)bw=Math.max(bw,line.x1-line.x0);for(const path of line.paths)for(const q of path.pts){y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}}
    if(!Number.isFinite(y0))return EMPTY;
    // Keep leading/trailing explicit blank lines as actual vertical space.
    if(!result.output[0].paths.length)y0=Math.min(y0,-1.7);
    if(!result.output.at(-1).paths.length)y1=Math.max(y1,(lines.length-1)*lh+.6);
    const availW=W-2*m,availH=H-2*m,k=Math.min(size,availW/Math.max(.001,bw),availH/Math.max(.001,y1-y0));
    const top=m+(availH-(y1-y0)*k)*val('position',50,0,100)/100;
    const align=p.align==='Center'?.5:p.align==='Right'?1:0,layer=Math.round(val('layer',0,0,11)),paths=[];
    for(const line of result.output){if(!line.paths.length)continue;
      const left=m+(availW-(line.x1-line.x0)*k)*align;
      for(const path of line.paths)paths.push({pts:path.pts.map(([x,y])=>[left+(x-line.x0)*k,top+(y-y0)*k]),closed:false,layer});
    }
    return applyStyle({paths},ins[0]);
  },
};
