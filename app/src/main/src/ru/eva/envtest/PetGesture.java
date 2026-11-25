package ru.eva.envtest;

final class PetGesture {
    private PetGesture(){}

    static boolean handled(int mode){
        return mode==PetMotion.GREET||mode==PetMotion.STRETCHING||
            mode==PetMotion.IDLE_WINK||mode==PetMotion.IDLE_YAWN;
    }

    static void sample(PetPlay.Pose p,int mode,long elapsed,int duration,PetMood mood){
        float t=PetMotion.clamp(elapsed/(float)duration,0,1);
        float hold=PetMotion.ease(t/.31f)*PetMotion.ease((1-t)/.29f);
        float breath=(float)Math.sin(Math.PI*t);
        p.reveal=p.accent=p.kick=p.lean=p.sink=p.shift=p.near=p.far=0;
        p.resetArms();
        p.wink=false;
        if(mode==PetMotion.STRETCHING){
            p.nearShoulder=-70*hold;
            p.farShoulder=59*hold;
            p.near=-143*hold;
            p.far=137*hold;
            p.lean=-5*breath;
            p.shift=4*breath;
            p.sink=5*hold;
            mood.face=PetMood.Face.PLEASED;
        }else if(mode==PetMotion.IDLE_YAWN){
            p.reachMouth(hold);
            p.near-=17*hold; // Cover the mouth with the palm.
            p.far=12*hold;
            p.lean=-4*breath;
            p.sink=4*hold;
            mood.face=PetMood.Face.BLINK;
        }else{
            boolean wink=mode==PetMotion.IDLE_WINK;
            float wag=(float)Math.sin(2*Math.PI*(wink?2.3f:1.7f)*t);
            p.nearShoulder=-(wink?37:53)*hold;
            p.near=(-149+19*wag)*hold;
            p.far=7*hold;
            p.shift=4*breath;
            p.lean=(wink?-5:3)*breath;
            p.sink=3*hold;
            p.wink=wink;
            mood.face=wink?PetMood.Face.BLINK:PetMood.Face.PLEASED;
            if(wink)hold=PetMotion.ease((t-.33f)/.07f)*PetMotion.ease((.64f-t)/.09f);
        }
        mood.weight=hold;
        if(hold<.015f)mood.face=PetMood.Face.NEUTRAL;
    }
}
