package ru.eva.envtest;

import java.util.Arrays;
import java.util.Collections;
import java.util.Random;

public final class PetCaptionSyncTest {
    private static void check(boolean value,String message){
        if(!value)throw new AssertionError(message);
    }
    public static void main(String[] args){
        for(PetPlay.Act act:PetPlay.Act.values()){
            PetMood mood=new PetMood(new Random(1));
            mood.beginMotion(10000);
            mood.play(act,act.signatureMillis-1,PetMood.Cue.NONE,0);
            check(mood.quip==null,"Early caption: "+act);
            mood.play(act,act.signatureMillis,PetMood.Cue.NONE,0);
            check(Arrays.asList(PetRemarks.Moment.valueOf(act.name()).lines).contains(mood.quip),"Wrong caption: "+act);
        }
        for(PetSeat.Activity a:PetSeat.Activity.values()){
            PetSeat seat=new PetSeat(new Random(1));seat.begin();seat.activity=a;
            PetMood mood=new PetMood(new Random(2));mood.beginMotion(10000);
            boolean specific=false;
            for(int ms=0;ms<8500;ms+=40){
                seat.sample(ms);mood.seated(seat,ms);mood.updateCaption(10000+ms);
                if(a==PetSeat.Activity.DOZE){check(mood.quip==null,"Speaking in sleep");continue;}
                if(mood.quip==null||Arrays.asList(PetRemarks.Moment.SEAT.lines).contains(mood.quip))continue;
                check(Arrays.asList(PetRemarks.Moment.valueOf(a.name()).lines).contains(mood.quip)&&seat.reveal>.85f,
                    "Spoke before the "+a+" prop was visible");
                specific=true;
            }
            check(specific==(a!=PetSeat.Activity.DOZE),"Missing activity caption: "+a);
        }
        for(int kind:new int[]{PetHomeMap.ICON,PetHomeMap.FOLDER,PetHomeMap.WIDGET,PetHomeMap.KEYBOARD,PetHomeMap.APP_WINDOW}){
            PetBall ball=new PetBall(100,150,0,180,1,600,600);
            PetHomeMap.Box box=new PetHomeMap.Box(kind,40,190,170,260);
            for(int n=0;n<24&&ball.contacts==0;n++)ball.step(.02f,Collections.singletonList(box));
            check(ball.contacts>0,"Missed target");
            check((ball.lastBounce==PetMood.Cue.ICON)==(kind==PetHomeMap.ICON||kind==PetHomeMap.FOLDER),
                "Incorrect icon response for "+kind);
        }
        System.out.println("Caption sync: action cues, visible seated props, silent doze, surface-aware bounces passed");
    }
}
