package ru.eva.envtest;

/** Integer scores compare the four available parking spots without reading screen content. */
final class PetAppPolicy {
    static int floorY(int height,int spriteHeight,boolean aboveIme,int imeTop){
        int bottom=Math.max(0,height-spriteHeight);
        if(!aboveIme)return bottom;
        int soles=Math.round(spriteHeight*PetHomeMap.SOLE_CONTACT);
        return Math.max(0,Math.min(bottom,imeTop-soles));
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
