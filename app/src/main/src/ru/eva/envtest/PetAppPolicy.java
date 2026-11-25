package ru.eva.envtest;

/** Scores use screen geometry to choose a parking spot. */
final class PetAppPolicy {
    static int keyboardChairY(int height,int spriteHeight,int edgeTop){
        int y=edgeTop-Math.round(spriteHeight*PetChair.FLOOR_CONTACT);
        return y>=0&&y+spriteHeight<=height?y:-1;
    }

    static int[] keyboardChairSpan(int width,int spriteWidth,int left,int right){
        int inset=Math.round(spriteWidth*PetChair.FOOT_INSET);
        int first=Math.max(0,left-inset);
        int last=Math.min(width-spriteWidth,right-spriteWidth+inset);
        return first<=last?new int[]{first,last}:null;
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
