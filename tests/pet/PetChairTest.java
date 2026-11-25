package ru.eva.envtest;

final class PetChairTest {
    private static void check(boolean ok,String reason){
        if(!ok)throw new AssertionError(reason);
    }
    public static void main(String[] args){
        PetChair chair=new PetChair();
        chair.set(true,1000,true);
        for(int i=0;i<=PetChair.DURATION;i+=8){
            float t=chair.phase(1000+i);
            check(PetChair.unfolding(t)>=.999f||PetChair.sitting(t)==0,"Hips descend before the seat opens");
        }
        long stop=1900;
        float opened=chair.phase(stop);
        chair.set(false,stop,true);
        check(chair.phase(stop)==opened,"Flashed closed on interruption");
        check(chair.phase(stop+PetChair.DURATION)==0,"Chair left on screen");
        chair.set(true,4000,false);
        check(chair.phase(4000)==1,"Reduced motion should start fully seated");
        chair.set(false,4100,false);
        check(chair.phase(4100)==0,"Dragging left open chair");
        check(PetChair.hipOn(144,237,178,100,50,150,270,false,2),"Missed platform below hips");
        check(!PetChair.hipOn(144,320,178,100,50,150,270,false,2),"Treated sole contact as sitting support");
        check(!PetChair.hipOn(175,237,220,100,50,150,270,false,2),"Seated beside edge");
        check(PetChair.hipOn(175,237,220,100,50,150,270,true,2),"Facing left missed hip contact");
        System.out.println("Chair: opens before sitting, reverses continuously, reduced motion, bilateral ledges");
    }
}
