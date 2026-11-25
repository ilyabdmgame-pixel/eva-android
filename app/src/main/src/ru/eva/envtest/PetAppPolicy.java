package ru.eva.envtest;

/** Scores use screen geometry to choose a parking spot. */
final class PetAppPolicy {
    static int clearEditorY(int y,int spriteHeight,int editorTop,int editorBottom){
        if(y>=editorBottom||y+spriteHeight<=editorTop)return y;
        return Math.max(0,editorTop-spriteHeight);
    }

    static int imeChairY(int height,int spriteHeight,boolean aboveIme,int imeTop){
        int bottom=Math.max(0,height-spriteHeight);
        return aboveIme?Math.max(0,Math.min(bottom,imeTop-spriteHeight)):bottom;
    }

    static int cost(int low,int y,int x,int previousX,int height,int buttonCount,
        boolean overlapsEditor,boolean overlapsKeyboard,boolean abovePlayer){
        int score=(low-y)*2+Math.abs(x-previousX)/9+buttonCount*height*3;
        if(overlapsEditor)score+=height*8;
        if(overlapsKeyboard)score+=height*10;
        if(abovePlayer)score+=height;
        return score;
    }

    static boolean watching(boolean player,boolean pauseControl,boolean audible,boolean largeGenericSurface,
        boolean videoApp){
        return player&&(pauseControl||audible&&(!largeGenericSurface||videoApp));
    }
}
