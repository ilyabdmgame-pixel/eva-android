package ru.eva.envtest;

final class PetAppPolicyTest {
    public static void main(String[] args){
        if(PetAppPolicy.clearEditorY(560,230,740,800)!=510||
            PetAppPolicy.clearEditorY(500,230,740,800)!=500)
            throw new AssertionError("Parking must clear the text field while typing");
        int chair=PetAppPolicy.imeChairY(1700,360,true,1120);
        if(chair+360!=1120||PetAppPolicy.clearEditorY(chair,360,980,1120)+360!=980||
            PetAppPolicy.imeChairY(1700,360,false,1120)!=1340||
            PetAppPolicy.imeChairY(420,360,true,180)!=0)
            throw new AssertionError("Keep the entire chair above the IME and the composer");
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
