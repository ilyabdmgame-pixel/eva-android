package ru.eva.envtest;

final class PetAppPolicyTest {
    public static void main(String[] args){
        if(PetAppPolicy.floorY(931,276,false,0)!=655||
            PetAppPolicy.floorY(1953,276,true,1118)+Math.round(276*PetHomeMap.SOLE_CONTACT)!=1118||
            PetAppPolicy.floorY(1953,276,true,2500)!=1677||
            PetAppPolicy.floorY(420,276,true,160)!=0)
            throw new AssertionError("Place soles at IME top or on the visible movie floor");
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
