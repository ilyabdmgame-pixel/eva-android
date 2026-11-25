package ru.eva.envtest;

import java.util.Arrays;

final class PetAppPolicyTest {
    public static void main(String[] args){
        int floor=Math.round(410*PetChair.FLOOR_CONTACT);
        if(PetAppPolicy.keyboardChairY(2445,410,1441)+floor!=1441||
            PetAppPolicy.keyboardChairY(2445,410,1450)+floor!=1450||
            PetAppPolicy.keyboardChairY(420,360,180)!=-1)
            throw new AssertionError("Chair feet must meet the keyboard edge as it moves");
        if(!Arrays.equals(PetAppPolicy.keyboardChairSpan(1200,306,0,1200),new int[]{0,894})||
            !Arrays.equals(PetAppPolicy.keyboardChairSpan(1200,306,650,970),new int[]{570,744})||
            PetAppPolicy.keyboardChairSpan(1200,306,655,790)!=null)
            throw new AssertionError("Fit both chair feet on full-width or floating keyboard edges");
        int safe=PetAppPolicy.cost(900,900,700,0,1200,0,false,false,false);
        int overButton=PetAppPolicy.cost(900,900,0,0,1200,1,false,false,false);
        int overInput=PetAppPolicy.cost(900,900,0,0,1200,0,true,true,false);
        int high=PetAppPolicy.cost(900,650,0,0,1200,0,false,false,false);
        if(safe>=high||high>=overButton||overButton>=overInput)
            throw new AssertionError("Prefer clear bottom corner to hovering over controls");
        if(PetAppPolicy.watching(true,false,true,true,false)||
            PetAppPolicy.watching(false,false,true,false,true)||
            !PetAppPolicy.watching(true,true,false,false,false)||
            !PetAppPolicy.watching(true,false,true,false,false))
            throw new AssertionError("A video needs visible player and playback evidence");
        System.out.println("App policy: corner placement, control avoidance, video playback signals");
    }
}
