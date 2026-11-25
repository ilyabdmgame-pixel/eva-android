package ru.eva.envtest;

import java.util.HashSet;
import java.util.Random;
import java.util.Set;

public class PetStoriesTest {
    private static void check(boolean yes){if(!yes)throw new AssertionError();}
    public static void main(String[] args){
        PetStories stories=new PetStories(new Random(124));
        PetMood mood=new PetMood(new Random(2));
        long time=1000;
        for(int cycle=0;cycle<2;cycle++){
            Set<PetStories.Story> seen=new HashSet<>();
            for(int i=0;i<PetStories.Story.values().length;i++){
                check(stories.start(time)&&seen.add(stories.active));
                for(int beat=0;beat<3;beat++){
                    long cue=time+stories.lineAt();
                    mood.beginMotion(time);
                    mood.play(stories.act(),stories.lineAt(),PetMood.Cue.NONE,0,false);
                    check(mood.sayLine(stories.line(),cue));
                    check(!mood.sayLine("collision",cue+25));
                    check(stories.line().equals(mood.quip));
                    time+=stories.act().duration;
                    check(stories.advance()==(beat<2));
                }
                stories.cancel();
                check(!stories.advance()&&!stories.start(time)&&!stories.start(time+10));
                check(!stories.start(time+20));
                time+=PetStories.REST_MS;
            }
        }
        check(stories.start(time));
        stories.advance();
        stories.cancel();
        check(!stories.advance()&&stories.active==null&&stories.beat==0);
        System.out.println("Six spontaneous stories: deck, three visual beats, readable lines, interruption, cooldown checked");
    }
}
